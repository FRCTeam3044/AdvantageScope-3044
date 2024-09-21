import { createUUID } from "../../shared/util";
import TabController from "./TabController";

export default class ConfigEditorController implements TabController {
  UUID = createUUID();

  saveState(): unknown {
    return null;
  }
  restoreState(state: unknown): void {}
  refresh(): void {}
  newAssets(): void {}
  getActiveFields(): string[] {
    return ["NT:/OxConfig/Params", "NT:/OxConfig/Modes", "NT:/OxConfig/CurrentMode", "NT:/OxConfig/Raw"];
  }
  showTimeline(): boolean {
    return false;
  }
  getCommand(): unknown {
    return {};
  }
}
