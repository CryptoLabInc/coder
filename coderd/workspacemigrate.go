package coderd

import (
	"net/http"

	"github.com/google/uuid"

	"github.com/coder/coder/v2/coderd/database"
	"github.com/coder/coder/v2/coderd/database/dbauthz"
	"github.com/coder/coder/v2/coderd/database/dbtime"
	"github.com/coder/coder/v2/coderd/httpapi"
	"github.com/coder/coder/v2/coderd/httpmw"
	"github.com/coder/coder/v2/coderd/rbac/policy"
	"github.com/coder/coder/v2/codersdk"
)

// resolveUserEmailsToIDs looks up each email and returns a set of owner IDs.
// If any email is not found, it writes a 400 response and returns false.
func (api *API) resolveUserEmailsToIDs(rw http.ResponseWriter, r *http.Request, emails []string) (map[uuid.UUID]struct{}, bool) {
	ctx := r.Context()
	ownerIDs := make(map[uuid.UUID]struct{}, len(emails))
	for _, email := range emails {
		// nolint:gocritic
		user, err := api.Database.GetUserByEmailOrUsername(dbauthz.AsSystemRestricted(ctx), database.GetUserByEmailOrUsernameParams{
			Email: email,
		})
		if httpapi.Is404Error(err) {
			httpapi.Write(ctx, rw, http.StatusBadRequest, codersdk.Response{
				Message: "User not found.",
				Detail:  "No user exists with email: " + email,
			})
			return nil, false
		}
		if err != nil {
			httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
				Message: "Failed to fetch user.",
				Detail:  err.Error(),
			})
			return nil, false
		}
		ownerIDs[user.ID] = struct{}{}
	}
	return ownerIDs, true
}

// @Summary Migrate workspaces to another template
// @ID migrate-workspaces-to-template
// @Security CoderSessionToken
// @Accept json
// @Produce json
// @Tags Templates
// @Param template path string true "Source Template ID" format(uuid)
// @Param request body codersdk.MigrateWorkspacesRequest true "Migration request"
// @Success 200 {object} codersdk.MigrateWorkspacesResponse
// @Router /templates/{template}/migrate-workspaces [post]
func (api *API) postMigrateWorkspacesByTemplate(rw http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	sourceTemplate := httpmw.TemplateParam(r)

	// Only template admins (those who can update the template) may migrate workspaces.
	if !api.Authorize(r, policy.ActionUpdate, sourceTemplate) {
		httpapi.Forbidden(rw)
		return
	}

	var req codersdk.MigrateWorkspacesRequest
	if !httpapi.Read(ctx, rw, r, &req) {
		return
	}

	if req.TargetTemplateID == sourceTemplate.ID {
		httpapi.Write(ctx, rw, http.StatusBadRequest, codersdk.Response{
			Message: "Target template must be different from the source template.",
		})
		return
	}

	// Fetch target template using system context to bypass per-template read restrictions.
	// nolint:gocritic
	targetTemplate, err := api.Database.GetTemplateByID(dbauthz.AsSystemRestricted(ctx), req.TargetTemplateID)
	if httpapi.Is404Error(err) {
		httpapi.Write(ctx, rw, http.StatusBadRequest, codersdk.Response{
			Message: "Target template not found.",
		})
		return
	}
	if err != nil {
		httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
			Message: "Failed to fetch target template.",
			Detail:  err.Error(),
		})
		return
	}

	// Caller must also have use permission on the target template.
	if !api.Authorize(r, policy.ActionUse, targetTemplate) {
		httpapi.Forbidden(rw)
		return
	}

	// Both templates must belong to the same organization.
	if sourceTemplate.OrganizationID != targetTemplate.OrganizationID {
		httpapi.Write(ctx, rw, http.StatusBadRequest, codersdk.Response{
			Message: "Source and target templates must belong to the same organization.",
		})
		return
	}

	// Optionally resolve the requested emails to a set of owner IDs for filtering.
	var ownerFilter map[uuid.UUID]struct{}
	if len(req.UserEmails) > 0 {
		var ok bool
		ownerFilter, ok = api.resolveUserEmailsToIDs(rw, r, req.UserEmails)
		if !ok {
			return
		}
	}

	// Fetch all workspaces belonging to the source template.
	// nolint:gocritic
	workspaces, err := api.Database.GetWorkspacesByTemplateID(dbauthz.AsSystemRestricted(ctx), sourceTemplate.ID)
	if err != nil {
		httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
			Message: "Failed to fetch workspaces.",
			Detail:  err.Error(),
		})
		return
	}

	var (
		migratedIDs []uuid.UUID
		skippedIDs  []uuid.UUID
	)

	for _, workspace := range workspaces {
		// If a user email filter is set, skip workspaces not owned by those users.
		if ownerFilter != nil {
			if _, ok := ownerFilter[workspace.OwnerID]; !ok {
				continue
			}
		}
		// nolint:gocritic
		latestBuild, err := api.Database.GetLatestWorkspaceBuildByWorkspaceID(dbauthz.AsSystemRestricted(ctx), workspace.ID)
		if err != nil {
			httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
				Message: "Failed to fetch latest workspace build.",
				Detail:  err.Error(),
			})
			return
		}

		// Skip workspaces that are currently running (last build was a start transition).
		// These must be stopped before migration.
		if latestBuild.Transition == database.WorkspaceTransitionStart {
			skippedIDs = append(skippedIDs, workspace.ID)
			continue
		}

		// nolint:gocritic
		_, err = api.Database.UpdateWorkspaceTemplateID(dbauthz.AsSystemRestricted(ctx), database.UpdateWorkspaceTemplateIDParams{
			ID:         workspace.ID,
			TemplateID: targetTemplate.ID,
			UpdatedAt:  dbtime.Now(),
		})
		if err != nil {
			httpapi.Write(ctx, rw, http.StatusInternalServerError, codersdk.Response{
				Message: "Failed to migrate workspace.",
				Detail:  err.Error(),
			})
			return
		}
		migratedIDs = append(migratedIDs, workspace.ID)
	}

	httpapi.Write(ctx, rw, http.StatusOK, codersdk.MigrateWorkspacesResponse{
		MigratedWorkspaceIDs: migratedIDs,
		SkippedWorkspaceIDs:  skippedIDs,
	})
}
