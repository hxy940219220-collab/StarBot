import type { ComputerUseState, MacPermissionId } from "@starbot/contracts/ipc";
import { onCleanup } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { ComputerUseSetup } from "../src/features/computer-use/ComputerUseSetup";
import { createMockStarBot } from "./mock-starbot";

function permissions(granted: readonly MacPermissionId[]): ComputerUseState["permissions"] {
  return (["screen-recording", "accessibility"] as const).map((id) => ({ id, granted: granted.includes(id) }));
}

const permissionsRequired: ComputerUseState = {
  status: "permissions-required",
  permissions: permissions([]),
  message: null,
};

function MockedSetup(props: { state?: ComputerUseState; error?: Error; loading?: boolean }) {
  const previousApi = window.starbot;
  const mock = createMockStarBot();
  mock.api.computerUse.getState = props.loading
    ? () => new Promise(() => undefined)
    : props.error
      ? async () => {
          throw props.error;
        }
      : async () => props.state ?? permissionsRequired;
  window.starbot = mock.api;
  onCleanup(() => {
    mock.dispose();
    window.starbot = previousApi;
  });
  return (
    <main class="foundation-story foundation-interaction-stage">
      <ComputerUseSetup variant="compact" />
    </main>
  );
}

const meta = {
  title: "Settings/ComputerUseSetup",
  component: ComputerUseSetup,
  parameters: { layout: "fullscreen", a11y: { test: "error" } },
} satisfies Meta<typeof ComputerUseSetup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PermissionsRequired: Story = {
  render: () => <MockedSetup />,
};

export const PartlyGranted: Story = {
  render: () => <MockedSetup state={{ ...permissionsRequired, permissions: permissions(["screen-recording"]) }} />,
};

export const Ready: Story = {
  render: () => (
    <MockedSetup
      state={{ status: "ready", permissions: permissions(["screen-recording", "accessibility"]), message: null }}
    />
  ),
};

export const RestartRequired: Story = {
  render: () => (
    <MockedSetup
      state={{
        status: "restart-required",
        permissions: permissions(["screen-recording", "accessibility"]),
        message: null,
      }}
    />
  ),
};

export const Loading: Story = {
  render: () => <MockedSetup loading />,
};

export const DriverMissing: Story = {
  render: () => (
    <MockedSetup
      state={{
        status: "driver-missing",
        permissions: permissions([]),
        message: "This build of StarBot carries no Computer Use driver.",
      }}
    />
  ),
};

export const ReadyWithoutPermissions: Story = {
  render: () => <MockedSetup state={{ status: "ready", permissions: [], message: null }} />,
};

export const ReadyWithoutInput: Story = {
  render: () => (
    <MockedSetup
      state={{
        status: "ready",
        permissions: [],
        message:
          "On this desktop, StarBot cannot type or click in other apps. For tasks on websites, ask the agent to use the StarBot browser.",
      }}
    />
  ),
};

export const Failure: Story = {
  render: () => <MockedSetup error={new Error("StarBot could not check Computer Use.")} />,
};
