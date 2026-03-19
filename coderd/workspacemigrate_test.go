package coderd_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/coder/coder/v2/coderd/coderdtest"
	"github.com/coder/coder/v2/coderd/database"
	"github.com/coder/coder/v2/coderd/rbac"
	"github.com/coder/coder/v2/codersdk"
	"github.com/coder/coder/v2/testutil"
)

func TestPostMigrateWorkspacesByTemplate(t *testing.T) {
	t.Parallel()

	// setup creates a client with a provisioner daemon, a first user (template admin),
	// a source template, and a target template in the same organization.
	setup := func(t *testing.T) (client *codersdk.Client, user codersdk.CreateFirstUserResponse, srcTemplate, dstTemplate codersdk.Template) {
		t.Helper()
		client = coderdtest.New(t, &coderdtest.Options{IncludeProvisionerDaemon: true})
		user = coderdtest.CreateFirstUser(t, client)

		srcVersion := coderdtest.CreateTemplateVersion(t, client, user.OrganizationID, nil)
		coderdtest.AwaitTemplateVersionJobCompleted(t, client, srcVersion.ID)
		srcTemplate = coderdtest.CreateTemplate(t, client, user.OrganizationID, srcVersion.ID)

		dstVersion := coderdtest.CreateTemplateVersion(t, client, user.OrganizationID, nil)
		coderdtest.AwaitTemplateVersionJobCompleted(t, client, dstVersion.ID)
		dstTemplate = coderdtest.CreateTemplate(t, client, user.OrganizationID, dstVersion.ID)

		return client, user, srcTemplate, dstTemplate
	}

	t.Run("OK_StoppedWorkspacesMigrated", func(t *testing.T) {
		t.Parallel()

		client, _, srcTemplate, dstTemplate := setup(t)
		ctx := testutil.Context(t, testutil.WaitLong)

		// Create a workspace and stop it so it qualifies for migration.
		workspace := coderdtest.CreateWorkspace(t, client, srcTemplate.ID)
		coderdtest.AwaitWorkspaceBuildJobCompleted(t, client, workspace.LatestBuild.ID)
		coderdtest.MustTransitionWorkspace(t, client, workspace.ID, database.WorkspaceTransitionStart, database.WorkspaceTransitionStop)

		resp, err := client.MigrateWorkspaces(ctx, srcTemplate.ID, codersdk.MigrateWorkspacesRequest{
			TargetTemplateID: dstTemplate.ID,
		})
		require.NoError(t, err)
		require.Contains(t, resp.MigratedWorkspaceIDs, workspace.ID)
		require.Empty(t, resp.SkippedWorkspaceIDs)

		// Verify the workspace now belongs to the target template.
		ws, err := client.Workspace(ctx, workspace.ID)
		require.NoError(t, err)
		require.Equal(t, dstTemplate.ID, ws.TemplateID)
	})

	t.Run("SkipsRunningWorkspaces", func(t *testing.T) {
		t.Parallel()

		client, _, srcTemplate, dstTemplate := setup(t)
		ctx := testutil.Context(t, testutil.WaitLong)

		// Create a workspace and leave it running (start transition).
		workspace := coderdtest.CreateWorkspace(t, client, srcTemplate.ID)
		coderdtest.AwaitWorkspaceBuildJobCompleted(t, client, workspace.LatestBuild.ID)

		resp, err := client.MigrateWorkspaces(ctx, srcTemplate.ID, codersdk.MigrateWorkspacesRequest{
			TargetTemplateID: dstTemplate.ID,
		})
		require.NoError(t, err)
		require.Contains(t, resp.SkippedWorkspaceIDs, workspace.ID)
		require.Empty(t, resp.MigratedWorkspaceIDs)

		// Workspace should still belong to the source template.
		ws, err := client.Workspace(ctx, workspace.ID)
		require.NoError(t, err)
		require.Equal(t, srcTemplate.ID, ws.TemplateID)
	})

	t.Run("MixedStoppedAndRunning", func(t *testing.T) {
		t.Parallel()

		client, _, srcTemplate, dstTemplate := setup(t)
		ctx := testutil.Context(t, testutil.WaitLong)

		// Stopped workspace.
		stopped := coderdtest.CreateWorkspace(t, client, srcTemplate.ID)
		coderdtest.AwaitWorkspaceBuildJobCompleted(t, client, stopped.LatestBuild.ID)
		coderdtest.MustTransitionWorkspace(t, client, stopped.ID, database.WorkspaceTransitionStart, database.WorkspaceTransitionStop)

		// Running workspace.
		running := coderdtest.CreateWorkspace(t, client, srcTemplate.ID)
		coderdtest.AwaitWorkspaceBuildJobCompleted(t, client, running.LatestBuild.ID)

		resp, err := client.MigrateWorkspaces(ctx, srcTemplate.ID, codersdk.MigrateWorkspacesRequest{
			TargetTemplateID: dstTemplate.ID,
		})
		require.NoError(t, err)
		require.Contains(t, resp.MigratedWorkspaceIDs, stopped.ID)
		require.Contains(t, resp.SkippedWorkspaceIDs, running.ID)
	})

	t.Run("SameTemplateError", func(t *testing.T) {
		t.Parallel()

		client, _, srcTemplate, _ := setup(t)
		ctx := testutil.Context(t, testutil.WaitLong)

		_, err := client.MigrateWorkspaces(ctx, srcTemplate.ID, codersdk.MigrateWorkspacesRequest{
			TargetTemplateID: srcTemplate.ID,
		})
		var sdkErr *codersdk.Error
		require.ErrorAs(t, err, &sdkErr)
		require.Equal(t, http.StatusBadRequest, sdkErr.StatusCode())
	})

	t.Run("TargetTemplateNotFound", func(t *testing.T) {
		t.Parallel()

		client, _, srcTemplate, _ := setup(t)
		ctx := testutil.Context(t, testutil.WaitLong)

		_, err := client.MigrateWorkspaces(ctx, srcTemplate.ID, codersdk.MigrateWorkspacesRequest{
			TargetTemplateID: uuid.New(),
		})
		var sdkErr *codersdk.Error
		require.ErrorAs(t, err, &sdkErr)
		require.Equal(t, http.StatusBadRequest, sdkErr.StatusCode())
	})

	t.Run("Unauthorized_RegularUser", func(t *testing.T) {
		t.Parallel()

		client, user, srcTemplate, dstTemplate := setup(t)
		ctx := testutil.Context(t, testutil.WaitLong)

		// Create a member (non-admin) user.
		memberClient, _ := coderdtest.CreateAnotherUser(t, client, user.OrganizationID, rbac.RoleMember())

		_, err := memberClient.MigrateWorkspaces(ctx, srcTemplate.ID, codersdk.MigrateWorkspacesRequest{
			TargetTemplateID: dstTemplate.ID,
		})
		var sdkErr *codersdk.Error
		require.ErrorAs(t, err, &sdkErr)
		require.Equal(t, http.StatusForbidden, sdkErr.StatusCode())
	})

	t.Run("UserEmailFilter_OnlyMigratesMatchingOwner", func(t *testing.T) {
		t.Parallel()

		client, user, srcTemplate, dstTemplate := setup(t)
		ctx := testutil.Context(t, testutil.WaitLong)

		// Create a second user who will own a workspace.
		targetClient, targetUser := coderdtest.CreateAnotherUser(t, client, user.OrganizationID)

		// Workspace owned by the target user (stopped → eligible).
		targetWS := coderdtest.CreateWorkspace(t, targetClient, srcTemplate.ID)
		coderdtest.AwaitWorkspaceBuildJobCompleted(t, client, targetWS.LatestBuild.ID)
		coderdtest.MustTransitionWorkspace(t, targetClient, targetWS.ID, database.WorkspaceTransitionStart, database.WorkspaceTransitionStop)

		// Workspace owned by the admin (stopped → eligible but should be excluded by filter).
		adminWS := coderdtest.CreateWorkspace(t, client, srcTemplate.ID)
		coderdtest.AwaitWorkspaceBuildJobCompleted(t, client, adminWS.LatestBuild.ID)
		coderdtest.MustTransitionWorkspace(t, client, adminWS.ID, database.WorkspaceTransitionStart, database.WorkspaceTransitionStop)

		resp, err := client.MigrateWorkspaces(ctx, srcTemplate.ID, codersdk.MigrateWorkspacesRequest{
			TargetTemplateID: dstTemplate.ID,
			UserEmails:       []string{targetUser.Email},
		})
		require.NoError(t, err)
		require.Contains(t, resp.MigratedWorkspaceIDs, targetWS.ID)
		require.NotContains(t, resp.MigratedWorkspaceIDs, adminWS.ID)
		require.Empty(t, resp.SkippedWorkspaceIDs)

		// targetUser's workspace → migrated.
		ws, err := client.Workspace(ctx, targetWS.ID)
		require.NoError(t, err)
		require.Equal(t, dstTemplate.ID, ws.TemplateID)

		// admin's workspace → untouched.
		ws, err = client.Workspace(ctx, adminWS.ID)
		require.NoError(t, err)
		require.Equal(t, srcTemplate.ID, ws.TemplateID)
	})

	t.Run("UserEmailFilter_UnknownEmailReturns400", func(t *testing.T) {
		t.Parallel()

		client, _, srcTemplate, dstTemplate := setup(t)
		ctx := testutil.Context(t, testutil.WaitLong)

		_, err := client.MigrateWorkspaces(ctx, srcTemplate.ID, codersdk.MigrateWorkspacesRequest{
			TargetTemplateID: dstTemplate.ID,
			UserEmails:       []string{"nonexistent@example.com"},
		})
		var sdkErr *codersdk.Error
		require.ErrorAs(t, err, &sdkErr)
		require.Equal(t, http.StatusBadRequest, sdkErr.StatusCode())
	})

	t.Run("NoWorkspacesReturnsEmpty", func(t *testing.T) {
		t.Parallel()

		client, _, srcTemplate, dstTemplate := setup(t)
		ctx := testutil.Context(t, testutil.WaitLong)

		resp, err := client.MigrateWorkspaces(ctx, srcTemplate.ID, codersdk.MigrateWorkspacesRequest{
			TargetTemplateID: dstTemplate.ID,
		})
		require.NoError(t, err)
		require.Empty(t, resp.MigratedWorkspaceIDs)
		require.Empty(t, resp.SkippedWorkspaceIDs)
	})
}
