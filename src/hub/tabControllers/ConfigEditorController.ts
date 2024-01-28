import { TabState } from "../../shared/HubState";
import TabType from "../../shared/TabType";
import TabController from "../TabController";
import fuzzysort from "fuzzysort";
import LoggableType from "../../shared/log/LoggableType";
import { getOrDefault } from "../../shared/log/LogUtil";

export default class ConfigEditorController implements TabController {
  private PARAMETER_TABLE: HTMLElement;
  private PARAMETER_TABLE_HEADERS: HTMLElement;
  private SEARCH_INPUT: HTMLElement;
  private MODE_DROPDOWN: HTMLElement;
  private WARNING_DIV: HTMLElement;
  private NO_DEPLOY_WARNING: HTMLElement;
  private FAILED_DEPLOY_WARNING: HTMLElement;
  private SUCCESS_WARNING: HTMLElement;
  private DEPLOY_DIR: HTMLElement;
  private parameters = new Map();
  private parametersSearched = new Map();
  private oldArr = [];
  private mode = "failed";

  private hasLoaded = false;

  private modes: string[] = [];

  private curDeployDir: string | null = null;
  private oldRawTimestamp: string = "0";
  private successLeaveTimeout: NodeJS.Timeout | null = null;

  constructor(content: HTMLElement) {
    this.PARAMETER_TABLE = content.getElementsByClassName("parameter-table")[0] as HTMLElement;
    this.SEARCH_INPUT = content.getElementsByClassName("config-search")[0] as HTMLElement;
    this.PARAMETER_TABLE_HEADERS = content.getElementsByClassName("parameter-table-headers")[0] as HTMLElement;
    this.MODE_DROPDOWN = content.getElementsByClassName("mode-dropdown")[0] as HTMLElement;
    this.WARNING_DIV = content.getElementsByClassName("warning")[0] as HTMLElement;
    this.NO_DEPLOY_WARNING = content.getElementsByClassName("warning")[1] as HTMLElement;
    this.FAILED_DEPLOY_WARNING = content.getElementsByClassName("warning")[2] as HTMLElement;
    this.SUCCESS_WARNING = content.getElementsByClassName("warning")[3] as HTMLElement;
    this.DEPLOY_DIR = content.getElementsByClassName("deploy-dir-path")[0] as HTMLElement;
    this.SEARCH_INPUT.addEventListener("input", (e: Event) => {
      let { target } = e;
      if (target == null) return;
      this.search((target as HTMLInputElement).value);
    });
    this.MODE_DROPDOWN.addEventListener("change", (e: Event) => {
      window.setNt4("/OxConfig/ModeSetter", (this.MODE_DROPDOWN as HTMLSelectElement).value, "string");
    });
  }
  newAssets(): void {}

  getActiveFields(): string[] {
    return ["NT:/OxConfig/Params", "NT:/OxConfig/Modes", "NT:/OxConfig/CurrentMode", "NT:/OxConfig/Raw"];
  }

  saveState(): TabState {
    return {
      type: TabType.ConfigEditor
    };
  }

  restoreState(state: TabState) {}

  writeResult(result: string) {
    if (result != "noexist") {
      this.FAILED_DEPLOY_WARNING.style.display = "none";
      if (result == "success") {
        this.SUCCESS_WARNING.style.opacity = "1";
        this.SUCCESS_WARNING.style.display = "block";
        if (this.successLeaveTimeout != null) clearTimeout(this.successLeaveTimeout);
        this.successLeaveTimeout = setTimeout(() => {
          this.SUCCESS_WARNING.style.opacity = "0";
          setTimeout(() => {
            this.SUCCESS_WARNING.style.display = "none";
          }, 500);
        }, 2500);
      } else if (result == "writeerror") {
        (this.FAILED_DEPLOY_WARNING.getElementsByClassName("warning-content")[0] as HTMLElement).innerText =
          "Failed to write file, ensure you have permission.";
        this.SUCCESS_WARNING.style.opacity = "0";
        this.SUCCESS_WARNING.style.display = "none";
        this.FAILED_DEPLOY_WARNING.style.display = "block";
      }
    } else {
      (this.FAILED_DEPLOY_WARNING.getElementsByClassName("warning-content")[0] as HTMLElement).innerText =
        "Failed to write file: Deploy directory is missing or doesn't contain config.json.";
      this.SUCCESS_WARNING.style.opacity = "0";
      this.SUCCESS_WARNING.style.display = "none";
      this.FAILED_DEPLOY_WARNING.style.display = "block";
    }
  }
  refresh() {
    this.reloadParameters();
  }
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
      let commentDiv = document.createElement("div");
      let commentInput = document.createElement("input");
      let param = this.parametersSearched.get(key);
      commentInput.value = param.comment;
      inputElements.push(commentInput);
      commentCell.appendChild(commentDiv);
      commentDiv.appendChild(commentInput);
      row.appendChild(keyCell);
      row.appendChild(commentCell);

      commentInput.addEventListener("input", () => {
        var c = commentInput.selectionStart;
        if (c == null) return;
        let i = 0;
        while (commentInput.value.includes(",")) {
          commentInput.value = commentInput.value.replace(",", "");
          c--;
          i++;
          if (i > 25) break;
        }
        commentInput.setSelectionRange(c, c);
      });

      for (let modeIndex in this.modes) {
        let valueInput = document.createElement("input");
        let valueDiv = document.createElement("div");
        valueDiv.appendChild(valueInput);
        inputElements.push(valueInput);
        let value = param.values[modeIndex];
        if (param.type == "boolean") {
          valueInput.type = "checkbox";
          valueInput.checked = value == "true";
        } else if (["integer", "short", "long", "double", "float"].includes(param.type)) {
          valueInput.type = "number";
          valueInput.value = value;

          switch (param.type) {
            case "integer":
              valueInput.step = "1";
              valueInput.max = "2147483647";
              valueInput.min = "-2147483648";
              break;
            case "short":
              valueInput.step = "1";
              valueInput.max = "32767";
              valueInput.min = "-32768";
              break;
            case "long":
              valueInput.step = "1";
              valueInput.max = "9223372036854775807";
              valueInput.min = "-9223372036854775808";
              break;
            case "double":
              valueInput.step = "0.000000000000001";
              valueInput.max = "1.7976931348623157E308";
              valueInput.min = "-1.7976931348623157E308";
              break;
            case "float":
              valueInput.step = "0.000000000000001";
              valueInput.max = "3.4028235E38";
              valueInput.min = "-3.4028235E38";
              break;
          }
          valueInput.addEventListener("keypress", function (evt: KeyboardEvent) {
            if (evt.key == "e" || evt.key == "+") evt.preventDefault();
            if (["integer", "short", "long"].includes(param.type) && evt.key == ".") evt.preventDefault();
          });

          valueInput.addEventListener("input", function (evt: Event) {
            const currentValue = parseFloat(valueInput.value);
            const maxValue = parseFloat(valueInput.max);
            const minValue = parseFloat(valueInput.min);
            if (currentValue > maxValue || currentValue < minValue) {
              valueInput.dataset.previousValue = valueInput.dataset.previousValue ?? "";
              valueInput.value = valueInput.dataset.previousValue;
            } else {
              valueInput.dataset.previousValue = valueInput.value;
            }
          });
        } else {
          valueInput.type = "text";
          valueInput.value = value;
          valueInput.addEventListener("input", () => {
            var c = valueInput.selectionStart;
            if (c == null) return;
            let i = 0;
            while (valueInput.value.includes(",")) {
              valueInput.value = valueInput.value.replace(",", "");
              c--;
              i++;
              if (i > 25) break;
            }
            valueInput.setSelectionRange(c, c);
          });
        }

        let valueCell = document.createElement("td");
        valueCell.appendChild(valueDiv);
        row.appendChild(valueCell);
      }

      for (let input of inputElements) {
        input.addEventListener("change", () => {
          this.publishValues(key, inputElements);
        });
      }

      this.PARAMETER_TABLE.appendChild(row);
    }
    this.addResizer(this.PARAMETER_TABLE_HEADERS);
    this.initializeResize(this.PARAMETER_TABLE_HEADERS, this.PARAMETER_TABLE);
  }

  private addResizer(thead: HTMLElement) {
    const resizableColumns = thead.querySelectorAll("th:not(.no-resize)");
    resizableColumns.forEach((column) => {
      if (!column.querySelector(".resizer")) {
        const resizer = document.createElement("div");
        resizer.className = "resizer";
        column.appendChild(resizer);
      }
    });
  }

  private initializeResize(thead: HTMLElement, table: HTMLElement) {
    let isResizing = false;
    let resizingColumn: any = null;
    let startX = 0;
    let startWidth = 0;

    thead.addEventListener("mousedown", function (e) {
      if (e.target == null) return;
      let target = e.target as HTMLElement;
      if (target.classList.contains("resizer")) {
        const column = target.closest("th");
        if (column == null) return;
        const nextColumn = column.nextElementSibling;

        if (nextColumn && !nextColumn.classList.contains("no-resize")) {
          isResizing = true;
          resizingColumn = column;
          startX = e.pageX;
          startWidth = column.offsetWidth;

          table.classList.add("resizing");
        }
      }
    });

    document.addEventListener("mousemove", function (e) {
      if (isResizing) {
        const offset = e.pageX - startX;
        const newWidth = startWidth + offset;

        resizingColumn.style.width = newWidth + "px";
      }
    });

    document.addEventListener("mouseup", function () {
      if (isResizing) {
        isResizing = false;
        resizingColumn = null;
        startX = 0;
        startWidth = 0;

        table.classList.remove("resizing");
      }
    });
  }

  private reloadParameters() {
    let params = getOrDefault(window.log, "NT:/OxConfig/Params", LoggableType.String, Infinity, "");
    if (params == "") return;
    let paramsRaw = JSON.parse(params);
    this.loadModes();
    if (JSON.stringify(this.oldArr) == params) return;
    this.hasLoaded = true;

    this.oldArr = paramsRaw;
    this.parameters.clear();
    for (let paramRaw of paramsRaw) {
      if (paramRaw[0] == "root/mode") continue;
      // Not using .shift() because it modifies the original array, which causes infinite update loops
      let key = paramRaw[0];
      let comment = paramRaw[1];
      let type = paramRaw[2].toLowerCase();
      this.parameters.set(key, {
        values: paramRaw.slice(3),
        comment,
        type
      });
    }
    this.search((this.SEARCH_INPUT as HTMLInputElement).value);
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
    this.parametersSearched = new Map([...this.parametersSearched].sort());
    this.displayParams();
  }
  periodic() {
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

    if (this.curDeployDir == null) return;

    let split = getOrDefault(window.log, "NT:/OxConfig/Raw", LoggableType.String, Infinity, "");
    if (split == "") return;
    split = split.split(",");
    if (split[0] != this.oldRawTimestamp) {
      this.oldRawTimestamp = split.shift();
      window.writeOxConfig(this.curDeployDir, this.oldRawTimestamp, split.join(","));
    }
  }

  private publishValues(key: string, array: HTMLInputElement[]) {
    let keySet = [key.replace(/<span class='highlighted'>/g, "").replace(/<\/span>/g, "")];
    for (let input of array) {
      let valueRaw;
      if (input.type == "checkbox") {
        valueRaw = input.checked ? "true" : "false";
      } else {
        valueRaw = input.value;
      }
      if (valueRaw.length == 0) return;
      let value = valueRaw.replace(/<span class='highlighted'>/g, "").replace(/<\/span>/g, "");
      keySet.push(value);
    }

    window.setNt4("/OxConfig/KeySetter", keySet.join(","), "string");
  }

  private loadModes() {
    let modesRaw = getOrDefault(window.log, "NT:/OxConfig/Modes", LoggableType.String, Infinity, "");
    if (modesRaw != "") {
      let tempModes = modesRaw.split(",");
      if (tempModes.length > 0 && JSON.stringify(this.modes) != JSON.stringify(tempModes)) {
        this.modes = tempModes;
        this.PARAMETER_TABLE_HEADERS.innerHTML = "";
        this.MODE_DROPDOWN.innerHTML = "";
        let paramHeader = document.createElement("th");
        let paramDiv = document.createElement("div");
        paramDiv.innerText = "Parameter";
        paramHeader.className = "param-table-header";
        paramHeader.appendChild(paramDiv);
        this.PARAMETER_TABLE_HEADERS.appendChild(paramHeader);
        let commentHeader = document.createElement("th");
        let commentDiv = document.createElement("div");
        commentDiv.innerText = "Comment";
        commentHeader.className = "comment-table-header";
        commentHeader.appendChild(commentDiv);
        this.PARAMETER_TABLE_HEADERS.appendChild(commentHeader);
        for (let mode of this.modes) {
          let prettyMode = mode.charAt(0).toUpperCase();
          prettyMode += mode.slice(1);
          let header = document.createElement("th");
          let headerDiv = document.createElement("div");
          headerDiv.innerText = prettyMode;
          header.appendChild(headerDiv);
          this.PARAMETER_TABLE_HEADERS.appendChild(header);

          let choice = document.createElement("option");
          choice.value = mode;
          choice.innerText = prettyMode;
          this.MODE_DROPDOWN.appendChild(choice);
        }
      }
    }

    let mode = getOrDefault(window.log, "NT:/OxConfig/CurrentMode", LoggableType.String, Infinity, "");
    if (mode != "" && this.mode != mode) {
      (this.MODE_DROPDOWN as HTMLSelectElement).value = mode;
      this.mode = mode;
    }
  }
}
