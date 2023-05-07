import { TabState } from "../../shared/HubState";
import TabType from "../../shared/TabType";
import TabController from "../TabController";
import fuzzysort from "fuzzysort";
import fs from "fs";

export default class ConfigEditorController implements TabController {
  private PARAMETER_TABLE: HTMLElement;
  private PARAMETER_TABLE_HEADERS: HTMLElement;
  private SEARCH_INPUT: HTMLElement;
  private MODE_DROPDOWN: HTMLElement;
  private WARNING_DIV: HTMLElement;
  private NO_DEPLOY_WARNING: HTMLElement;
  private FAILED_DEPLOY_WARNING: HTMLElement;
  private DEPLOY_DIR: HTMLElement;
  private parameters = new Map();
  private parametersSearched = new Map();
  private oldArr = [];
  private mode = "testing";

  private hasLoaded = false;

  private modes: string[] = [];

  private curDeployDir: string | null = null;
  private oldRawTimestamp: string = "0";

  constructor(content: HTMLElement) {
    this.PARAMETER_TABLE = content.getElementsByClassName("parameter-table")[0] as HTMLElement;
    this.SEARCH_INPUT = content.getElementsByClassName("config-search")[0] as HTMLElement;
    this.PARAMETER_TABLE_HEADERS = content.getElementsByClassName("parameter-table-headers")[0] as HTMLElement;
    this.MODE_DROPDOWN = content.getElementsByClassName("mode-dropdown")[0] as HTMLElement;
    this.WARNING_DIV = content.getElementsByClassName("warning")[0] as HTMLElement;
    this.NO_DEPLOY_WARNING = content.getElementsByClassName("warning")[1] as HTMLElement;
    this.FAILED_DEPLOY_WARNING = content.getElementsByClassName("warning")[2] as HTMLElement;
    this.DEPLOY_DIR = content.getElementsByClassName("deploy-dir-path")[0] as HTMLElement;
    this.SEARCH_INPUT.addEventListener("input", (e: Event) => {
      let { target } = e;
      if (target == null) return;
      this.search((target as HTMLInputElement).value);
    });
    this.MODE_DROPDOWN.addEventListener("change", (e: Event) => {
      window.setNt4("/OxConfig/ModeSetter", (this.MODE_DROPDOWN as HTMLSelectElement).value);
    });
  }

  getActiveFields(): string[] {
    return ["NT:/OxConfig/Params", "NT:/OxConfig/Modes"];
  }

  saveState(): TabState {
    return {
      type: TabType.ConfigEditor
    };
  }

  restoreState(state: TabState) {}

  refresh() {}
  private displayParams() {
    this.PARAMETER_TABLE.innerHTML = "";
    if (this.parametersSearched == null || this.parametersSearched.size == 0) return;
    // Create a tr element for each parameter and add it to the parameter table
    for (let key of this.parametersSearched.keys()) {
      let inputElements: HTMLInputElement[] = [];

      let row = document.createElement("tr");
      let keyCell = document.createElement("td");
      let keyDiv = document.createElement("div");
      keyDiv.innerHTML = key;
      keyCell.appendChild(keyDiv);
      let commentCell = document.createElement("td");
      let commentInput = document.createElement("input");
      let param = this.parametersSearched.get(key);
      commentInput.value = param.comment;
      inputElements.push(commentInput);
      commentCell.appendChild(commentInput);
      row.appendChild(keyCell);
      row.appendChild(commentCell);

      for (let modeIndex in this.modes) {
        let valueInput = document.createElement("input");
        inputElements.push(valueInput);
        let value = param.values[modeIndex];
        if (value == "true" || value == "false") {
          valueInput.type = "checkbox";
          valueInput.checked = value == "true";
        } else if (!isNaN(value)) {
          valueInput.type = "number";
          valueInput.value = value;
        } else {
          valueInput.type = "text";
          valueInput.value = value;
        }

        let valueCell = document.createElement("td");
        valueCell.appendChild(valueInput);
        row.appendChild(valueCell);
      }

      for (let input of inputElements) {
        input.addEventListener("change", () => {
          this.publishValues(key, inputElements);
        });
      }

      this.PARAMETER_TABLE.appendChild(row);
    }
  }
  private reloadParameters() {
    let params = window.log.getString("NT:/OxConfig/Params", Infinity, Infinity);
    if (params == null) return;
    let paramsRaw = JSON.parse(params.values[0]);
    this.loadModes();
    if (JSON.stringify(this.oldArr) == JSON.stringify(paramsRaw)) return;
    this.hasLoaded = true;

    this.oldArr = paramsRaw;
    this.parameters.clear();
    for (let paramRaw of paramsRaw) {
      if (paramRaw[0] == "root/mode") continue;
      this.parameters.set(paramRaw[0], {
        values: paramRaw.slice(2),
        comment: paramRaw[1]
      });
    }
    this.search("");
    this.displayParams();
  }

  private search(search: string) {
    let results = fuzzysort.go(search, Array.from(this.parameters.keys()), {
      threshold: -1000000,
      all: true
    });
    this.parametersSearched.clear();
    for (let result of results) {
      let value = this.parameters.get(result.target);
      let highlighted = fuzzysort.highlight(result, "<span class='highlighted'>", "</span>");
      if (highlighted == null) continue;
      this.parametersSearched.set(highlighted, value);
    }
    this.displayParams();
  }
  periodic() {
    this.reloadParameters();
    if (this.hasLoaded && !window.isConnected()) {
      this.WARNING_DIV.style.display = "block";
    } else {
      this.WARNING_DIV.style.display = "none";
    }

    if (this.curDeployDir != window.preferences?.deployDirectory) {
      if (window.preferences?.deployDirectory == null || window.preferences?.deployDirectory == "") {
        this.DEPLOY_DIR.innerHTML = "Not Set";
        this.NO_DEPLOY_WARNING.style.display = "block";
      } else {
        this.curDeployDir = window.preferences?.deployDirectory;
        this.NO_DEPLOY_WARNING.style.display = "none";
        this.DEPLOY_DIR.innerHTML = this.curDeployDir;
      }
    }

    let raw = window.log.getString("NT:/OxConfig/Raw", Infinity, Infinity);
    if (raw == null) return;
    let split = raw.values[0].split(",");
    if (split[0] != this.oldRawTimestamp) {
      this.oldRawTimestamp = split[0];
      if (fs.existsSync(this.curDeployDir + "/config.yml")) {
        this.FAILED_DEPLOY_WARNING.style.display = "none";
        split.shift();
        let config = split.join(",");
        fs.writeFileSync(this.curDeployDir + "/config.yml", config);
      } else {
        this.FAILED_DEPLOY_WARNING.style.display = "block";
      }
    }
  }

  private publishValues(key: string, array: HTMLInputElement[]) {
    let keySet = [key];
    for (let input of array) {
      let valueRaw;
      if (input.type == "checkbox") {
        valueRaw = input.checked ? "true" : "false";
      } else {
        valueRaw = input.value;
      }
      let value = valueRaw.replace(/<span class='highlighted'>/g, "").replace(/<\/span>/g, "");
      keySet.push(value);
    }

    window.setNt4("/OxConfig/KeySetter", keySet.join(","));
  }

  private loadModes() {
    let mode = window.log.getString("NT:/OxConfig/CurrentMode", Infinity, Infinity)?.values[0];
    if (mode != null && this.mode != mode) (this.MODE_DROPDOWN as HTMLSelectElement).value = mode;

    let modesRaw = window.log.getString("NT:/OxConfig/Modes", Infinity, Infinity);
    if (modesRaw != null) {
      let tempModes = modesRaw.values[0].split(",");
      if (tempModes.length > 0 && JSON.stringify(this.modes) != JSON.stringify(tempModes)) {
        this.modes = tempModes;
        this.PARAMETER_TABLE_HEADERS.innerHTML = "";
        this.MODE_DROPDOWN.innerHTML = "";
        let paramHeader = document.createElement("th");
        paramHeader.innerText = "Parameter";
        paramHeader.className = "param-table-header";
        this.PARAMETER_TABLE_HEADERS.appendChild(paramHeader);
        let commentHeader = document.createElement("th");
        commentHeader.innerText = "Comment";
        commentHeader.className = "comment-table-header";
        this.PARAMETER_TABLE_HEADERS.appendChild(commentHeader);
        for (let mode of this.modes) {
          let prettyMode = mode.charAt(0).toUpperCase();
          prettyMode += mode.slice(1);
          let header = document.createElement("th");
          header.innerText = prettyMode;
          this.PARAMETER_TABLE_HEADERS.appendChild(header);

          let choice = document.createElement("option");
          choice.value = mode;
          choice.innerText = prettyMode;
          this.MODE_DROPDOWN.appendChild(choice);
        }
      }
    }
  }
}
