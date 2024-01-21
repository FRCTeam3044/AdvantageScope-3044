import { AllColors } from "../../shared/Colors";
import { LineGraphState } from "../../shared/HubState";
import LoggableType from "../../shared/log/LoggableType";
import { getLogValueText, getOrDefault } from "../../shared/log/LogUtil";
import { LogValueSetAny, LogValueSetNumber } from "../../shared/log/LogValueSets";
import TabType from "../../shared/TabType";
import { convertWithPreset, UnitConversionPreset } from "../../shared/units";
import { clampValue, cleanFloat, scaleValue, shiftColor, ValueScaler } from "../../shared/util";
import ScrollSensor from "../ScrollSensor";
import { SelectionMode } from "../Selection";
import TabController from "../TabController";

export default class TunerController implements TabController {
  private MIN_ZOOM_TIME = 0.05;
  private ZOOM_BASE = 1.001;
  private MIN_AXIS_RANGE = 1e-5;
  private MAX_AXIS_RANGE = 1e20;
  private MAX_DECIMAL_VALUE = 1e9; // After this, stop trying to display fractional values
  private MAX_VALUE = 1e20;
  private CONTENT: HTMLElement;
  private LEGEND_ITEM_TEMPLATE: HTMLElement;
  private CANVAS_CONTAINER: HTMLElement;
  private CANVAS: HTMLCanvasElement;
  private SCROLL_OVERLAY: HTMLElement;
  private CONTROLLER_DROPDOWN: HTMLSelectElement;
  private PARAMETER_TABLE: HTMLElement;
  private CUR_MODE_DROPDOWN: HTMLSelectElement;
  private EDIT_MODE_DROPDOWN: HTMLSelectElement;
  private COPY_MODE_DROPDOWN: HTMLSelectElement;
  private DEPLOY_DIR: HTMLElement;
  private WARNING_DIV: HTMLElement;
  private NO_DEPLOY_WARNING: HTMLElement;
  private FAILED_DEPLOY_WARNING: HTMLElement;
  private SUCCESS_WARNING: HTMLElement;

  private LEFT_LIST: HTMLElement;
  private DISCRETE_LIST: HTMLElement;
  private RIGHT_LIST: HTMLElement;
  private LEFT_LABELS: HTMLElement;
  private RIGHT_LABELS: HTMLElement;
  private LEFT_DRAG_TARGET: HTMLElement;
  private DISCRETE_DRAG_TARGET: HTMLElement;
  private RIGHT_DRAG_TARGET: HTMLElement;

  private controllerList = [];
  private modes: string[] = [];
  private mode: string = "testing";
  private curDeployDir: string = "failed";
  private curController: string = "";
  private hasLoaded = false;
  private oldRawTimestamp: string = "0";

  private successLeaveTimeout: NodeJS.Timeout | null = null;

  private leftFields: {
    key: string;
    color: string;
    show: boolean;
  }[] = [];
  private discreteFields: {
    key: string;
    color: string;
    show: boolean;
  }[] = [];
  private rightFields: {
    key: string;
    color: string;
    show: boolean;
  }[] = [];
  private leftLockedRange: [number, number] | null = null;
  private rightLockedRange: [number, number] | null = null;
  private leftRenderedRange: [number, number] = [-1, 1];
  private rightRenderedRange: [number, number] = [-1, 1];
  private leftUnitConversion: UnitConversionPreset = {
    type: null,
    factor: 1
  };
  private rightUnitConversion: UnitConversionPreset = {
    type: null,
    factor: 1
  };

  private timestampRange: [number, number] = [0, 10];
  private maxZoom = true; // When at maximum zoom, maintain it as the available range increases
  private lastCursorX: number | null = null;
  private panActive = false;
  private panStartCursorX = 0;
  private panLastCursorX = 0;
  private scrollSensor: ScrollSensor;
  private lastRenderState = "";
  private refreshCount = 0;

  constructor(content: HTMLElement) {
    this.CONTENT = content;
    this.LEGEND_ITEM_TEMPLATE = content.getElementsByClassName("legend-item-template")[0]
      .firstElementChild as HTMLElement;
    this.CANVAS_CONTAINER = content.getElementsByClassName("line-graph-canvas-container")[0] as HTMLElement;
    this.CANVAS = content.getElementsByClassName("line-graph-canvas")[0] as HTMLCanvasElement;
    this.SCROLL_OVERLAY = content.getElementsByClassName("line-graph-scroll")[0] as HTMLElement;

    this.LEFT_LIST = content.getElementsByClassName("legend-left")[0] as HTMLElement;
    this.DISCRETE_LIST = content.getElementsByClassName("legend-discrete")[0] as HTMLElement;
    this.RIGHT_LIST = content.getElementsByClassName("legend-right")[0] as HTMLElement;
    this.LEFT_LABELS = this.LEFT_LIST.firstElementChild?.firstElementChild?.lastElementChild as HTMLElement;
    this.RIGHT_LABELS = this.RIGHT_LIST.firstElementChild?.firstElementChild?.lastElementChild as HTMLElement;
    this.LEFT_DRAG_TARGET = content.getElementsByClassName("legend-left")[1] as HTMLElement;
    this.DISCRETE_DRAG_TARGET = content.getElementsByClassName("legend-discrete")[1] as HTMLElement;
    this.RIGHT_DRAG_TARGET = content.getElementsByClassName("legend-right")[1] as HTMLElement;

    // tuner code
    this.CONTROLLER_DROPDOWN = content.getElementsByClassName("controller-dropdown")[0] as HTMLSelectElement;
    this.PARAMETER_TABLE = content.getElementsByClassName("tuning-table")[0] as HTMLElement;
    this.CUR_MODE_DROPDOWN = content.getElementsByClassName("mode-dropdown")[0] as HTMLSelectElement;
    this.EDIT_MODE_DROPDOWN = content.getElementsByClassName("tuner-mode")[0] as HTMLSelectElement;
    this.COPY_MODE_DROPDOWN = content.getElementsByClassName("tuner-copy-mode")[0] as HTMLSelectElement;
    this.DEPLOY_DIR = content.getElementsByClassName("deploy-dir-path")[0] as HTMLElement;

    this.WARNING_DIV = content.getElementsByClassName("warning")[0] as HTMLElement;
    this.NO_DEPLOY_WARNING = content.getElementsByClassName("warning")[1] as HTMLElement;
    this.FAILED_DEPLOY_WARNING = content.getElementsByClassName("warning")[2] as HTMLElement;
    this.SUCCESS_WARNING = content.getElementsByClassName("warning")[3] as HTMLElement;

    this.CONTROLLER_DROPDOWN.addEventListener("change", () => {
      this.showController(this.CONTROLLER_DROPDOWN.value);
      this.curController = this.CONTROLLER_DROPDOWN.value;
    });

    this.EDIT_MODE_DROPDOWN.addEventListener("change", () => {
      this.showController(this.CONTROLLER_DROPDOWN.value);
    });

    this.CUR_MODE_DROPDOWN.addEventListener("change", (e: Event) => {
      window.setNt4("/OxConfig/ModeSetter", this.CUR_MODE_DROPDOWN.value);
    });

    (content.getElementsByClassName("copy-one")[0] as HTMLButtonElement).addEventListener("click", () => {
      let source = this.COPY_MODE_DROPDOWN.value ?? "";
      let dist = this.EDIT_MODE_DROPDOWN.value ?? "";
      let controller = this.curController;
      if (source == "" || dist == "" || controller == "" || controller == "failed") return;
      window.sendMainMessage("confirm-copy", {
        type: "one",
        source,
        dist,
        controller,
        title: "Copy To One Mode",
        message:
          "This action will overwrite all data for the selected edit mode on the selected controller, replacing it with the data for the currently selected copy mode. This action is irreversible."
      });
    });

    (content.getElementsByClassName("copy-all")[0] as HTMLButtonElement).addEventListener("click", () => {
      let source = this.EDIT_MODE_DROPDOWN.value ?? "";
      let controller = this.curController;
      if (source == "" || controller == "" || controller == "failed") return;
      window.sendMainMessage("confirm-copy", {
        type: "all",
        source,
        controller,
        title: "Copy To All Modes",
        message:
          "This action will overwrite all data for other modes on the selected controller, replacing them with the data for the currently selected edit mode. This action is irreversible."
      });
    });

    // Scroll handling
    this.SCROLL_OVERLAY.addEventListener("mousemove", (event) => {
      this.lastCursorX = event.clientX - this.SCROLL_OVERLAY.getBoundingClientRect().x;
    });
    this.SCROLL_OVERLAY.addEventListener("mouseleave", () => {
      this.lastCursorX = null;
    });
    this.scrollSensor = new ScrollSensor(this.SCROLL_OVERLAY, (dx: number, dy: number) => {
      this.updateScroll(dx, dy);
    });

    // Pan handling
    this.SCROLL_OVERLAY.addEventListener("mousedown", (event) => {
      this.panActive = true;
      let x = event.clientX - this.SCROLL_OVERLAY.getBoundingClientRect().x;
      this.panStartCursorX = x;
      this.panLastCursorX = x;
    });
    this.SCROLL_OVERLAY.addEventListener("mouseleave", () => {
      this.panActive = false;
    });
    this.SCROLL_OVERLAY.addEventListener("mouseup", () => {
      this.panActive = false;
    });
    this.SCROLL_OVERLAY.addEventListener("mousemove", (event) => {
      if (this.panActive) {
        let cursorX = event.clientX - this.SCROLL_OVERLAY.getBoundingClientRect().x;
        this.updateScroll(this.panLastCursorX - cursorX, 0);
        this.panLastCursorX = cursorX;
      }
    });

    // Selection handling
    this.SCROLL_OVERLAY.addEventListener("click", (event) => {
      if (Math.abs(event.clientX - this.SCROLL_OVERLAY.getBoundingClientRect().x - this.panStartCursorX) <= 5) {
        let hoveredTime = window.selection.getHoveredTime();
        if (hoveredTime) {
          window.selection.setSelectedTime(hoveredTime);
        }
      }
    });
    this.SCROLL_OVERLAY.addEventListener("contextmenu", () => {
      window.selection.goIdle();
    });

    // Drag handling
    window.addEventListener("drag-update", (event) => {
      this.handleDrag((event as CustomEvent).detail);
    });

    // Edit axis handling
    let leftExitAxisButton = this.LEFT_LIST.firstElementChild?.lastElementChild!;
    leftExitAxisButton.addEventListener("click", () => {
      let rect = leftExitAxisButton.getBoundingClientRect();
      window.sendMainMessage("ask-edit-axis", {
        x: Math.round(rect.right),
        y: Math.round(rect.top),
        legend: "left",
        lockedRange: this.leftLockedRange,
        unitConversion: this.leftUnitConversion
      });
    });
    let discreteEditAxisButton = this.DISCRETE_LIST.firstElementChild?.lastElementChild!;
    discreteEditAxisButton.addEventListener("click", () => {
      let rect = discreteEditAxisButton.getBoundingClientRect();
      window.sendMainMessage("ask-edit-axis", {
        x: Math.round(rect.right),
        y: Math.round(rect.top),
        legend: "discrete"
      });
    });
    let rightEditAxisButton = this.RIGHT_LIST.firstElementChild?.lastElementChild!;
    rightEditAxisButton.addEventListener("click", () => {
      let rect = rightEditAxisButton.getBoundingClientRect();
      window.sendMainMessage("ask-edit-axis", {
        x: Math.round(rect.right),
        y: Math.round(rect.top),
        legend: "right",
        lockedRange: this.rightLockedRange,
        unitConversion: this.rightUnitConversion
      });
    });
  }
  newAssets(): void {}

  confirmCopyAll(data: any) {
    window.setNt4("/OxConfig/ClassSetter", `copyAll,${data.controller},${data.source}`);
  }

  confirmCopyOne(data: any) {
    window.setNt4("/OxConfig/ClassSetter", `copyOne,${data.controller},${data.source},${data.dist}`);
  }

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
        "Failed to write file: Deploy directory is missing or doesn't contain config.yml.";
      this.SUCCESS_WARNING.style.opacity = "0";
      this.SUCCESS_WARNING.style.display = "none";
      this.FAILED_DEPLOY_WARNING.style.display = "block";
    }
  }

  saveState(): LineGraphState {
    return {
      type: TabType.Tuner,
      legends: {
        left: {
          lockedRange: this.leftLockedRange,
          unitConversion: this.leftUnitConversion,
          fields: this.leftFields
        },
        discrete: {
          fields: this.discreteFields
        },
        right: {
          lockedRange: this.rightLockedRange,
          unitConversion: this.rightUnitConversion,
          fields: this.rightFields
        }
      }
    };
  }

  restoreState(state: LineGraphState) {
    this.leftLockedRange = state.legends.left.lockedRange;
    this.rightLockedRange = state.legends.right.lockedRange;
    this.leftUnitConversion = state.legends.left.unitConversion;
    this.rightUnitConversion = state.legends.right.unitConversion;
    this.updateAxisLabels();

    // Remove old fields
    this.leftFields = [];
    this.discreteFields = [];
    this.rightFields = [];
    while (this.LEFT_LIST.children[1]) this.LEFT_LIST.removeChild(this.LEFT_LIST.children[1]);
    while (this.DISCRETE_LIST.children[1]) this.DISCRETE_LIST.removeChild(this.DISCRETE_LIST.children[1]);
    while (this.RIGHT_LIST.children[1]) this.RIGHT_LIST.removeChild(this.RIGHT_LIST.children[1]);

    // Add new fields
    state.legends.left.fields.forEach((field) => {
      this.addField("left", field.key, field.color, field.show);
    });
    state.legends.discrete.fields.forEach((field) => {
      this.addField("discrete", field.key, field.color, field.show);
    });
    state.legends.right.fields.forEach((field) => {
      this.addField("right", field.key, field.color, field.show);
    });
  }

  /** Updates the axis labels based on the locked and unit conversion status. */
  updateAxisLabels() {
    let leftLocked = this.leftLockedRange != null;
    let leftConverted = this.leftUnitConversion.type != null || this.leftUnitConversion.factor != 1;
    if (leftLocked && leftConverted) {
      this.LEFT_LABELS.innerText = " [Locked, Converted]";
    } else if (leftLocked) {
      this.LEFT_LABELS.innerText = " [Locked]";
    } else if (leftConverted) {
      this.LEFT_LABELS.innerText = " [Converted]";
    } else {
      this.LEFT_LABELS.innerText = "";
    }

    let rightLocked = this.rightLockedRange != null;
    let rightConverted = this.rightUnitConversion.type != null || this.rightUnitConversion.factor != 1;
    if (rightLocked && rightConverted) {
      this.RIGHT_LABELS.innerText = " [Locked, Converted]";
    } else if (rightLocked) {
      this.RIGHT_LABELS.innerText = " [Locked]";
    } else if (rightConverted) {
      this.RIGHT_LABELS.innerText = " [Converted]";
    } else {
      this.RIGHT_LABELS.innerText = "";
    }
  }

  /** Adjusts the locked range and unit conversion for an axis. */
  editAxis(legend: string, lockedRange: [number, number] | null, unitConversion: UnitConversionPreset) {
    switch (legend) {
      case "left":
        if (lockedRange == null) {
          this.leftLockedRange = null;
        } else if (lockedRange[0] == null && lockedRange[1] == null) {
          this.leftLockedRange = this.leftRenderedRange;
        } else {
          this.leftLockedRange = lockedRange;
        }
        this.leftUnitConversion = unitConversion;
        break;

      case "right":
        if (lockedRange == null) {
          this.rightLockedRange = null;
        } else if (lockedRange[0] == null && lockedRange[1] == null) {
          this.rightLockedRange = this.rightRenderedRange;
        } else {
          this.rightLockedRange = lockedRange;
        }
        this.rightUnitConversion = unitConversion;
        break;
    }
    this.updateAxisLabels();
  }

  /** Clears the fields for a legend. */
  clearAxis(legend: string) {
    switch (legend) {
      case "left":
        this.leftFields = [];
        while (this.LEFT_LIST.children[1]) this.LEFT_LIST.removeChild(this.LEFT_LIST.children[1]);
        break;

      case "discrete":
        this.discreteFields = [];
        while (this.DISCRETE_LIST.children[1]) this.DISCRETE_LIST.removeChild(this.DISCRETE_LIST.children[1]);
        break;

      case "right":
        this.rightFields = [];
        while (this.RIGHT_LIST.children[1]) this.RIGHT_LIST.removeChild(this.RIGHT_LIST.children[1]);
        break;
    }
  }

  refresh() {
    this.reloadControllerList();
    this.updateScroll();
    this.refreshCount += 1;

    // Update field strikethrough
    let availableFields = window.log.getFieldKeys();
    [
      { fields: this.leftFields, element: this.LEFT_LIST },
      { fields: this.discreteFields, element: this.DISCRETE_LIST },
      { fields: this.rightFields, element: this.RIGHT_LIST }
    ].forEach((data) => {
      let fields = data.fields;
      let element = data.element;

      for (let i = 0; i < fields.length; i++) {
        let keyElement = element.children[i + 1].getElementsByClassName("legend-key")[0] as HTMLElement;
        keyElement.style.textDecoration = availableFields.includes(fields[i].key) ? "initial" : "line-through";
      }
    });
  }

  private showController(key: String) {
    let controller: any = this.controllerList.find((c) => c[1] == key);
    if (controller == null) return;
    let parameters = controller.slice(2);
    // Create a tr element for each parameter and add it to the parameter table
    this.PARAMETER_TABLE.innerHTML = "";
    for (let i = 0; i < parameters.length; i++) {
      let tr = document.createElement("tr");
      // Parameter Name
      let td1 = document.createElement("td");
      // Need a div for truncation
      let nameDiv = document.createElement("div");
      nameDiv.innerText = parameters[i][0];
      td1.appendChild(nameDiv);

      // Value of parameter
      let td2 = document.createElement("td");
      let input = document.createElement("input");
      let type = parameters[i][2].toLowerCase();
      let value = parameters[i][this.modes.indexOf(this.EDIT_MODE_DROPDOWN.value) + 3];
      if (type == "boolean") {
        input.type = "checkbox";
        input.checked = value == "true";
      } else if (["integer", "short", "long", "double", "float"].includes(type)) {
        input.type = "number";
        input.value = value;
        switch (type) {
          case "integer":
            input.step = "1";
            input.max = "2147483647";
            input.min = "-2147483648";
            break;
          case "short":
            input.step = "1";
            input.max = "32767";
            input.min = "-32768";
            break;
          case "long":
            input.step = "1";
            input.max = "9223372036854775807";
            input.min = "-9223372036854775808";
            break;
          case "double":
            input.step = "0.000000000000001";
            input.max = "1.7976931348623157E308";
            input.min = "-1.7976931348623157E308";
            break;
          case "float":
            input.step = "0.000000000000001";
            input.max = "3.4028235E38";
            input.min = "-3.4028235E38";
        }
        input.addEventListener("keypress", function (evt: KeyboardEvent) {
          if (evt.key == "e" || evt.key == "+") evt.preventDefault();
          if (["integer", "short", "long"].includes(type) && evt.key == ".") evt.preventDefault();
        });

        input.addEventListener("input", function (evt: Event) {
          const currentValue = parseFloat(input.value);
          const maxValue = parseFloat(input.max);
          const minValue = parseFloat(input.min);
          if (currentValue > maxValue || currentValue < minValue) {
            input.dataset.previousValue = input.dataset.previousValue ?? "";
            input.value = input.dataset.previousValue;
          } else {
            input.dataset.previousValue = input.value;
          }
        });
      } else {
        input.type = "text";
        input.value = value;
        input.addEventListener("input", () => {
          var c = input.selectionStart;
          if (c == null) return;
          let i = 0;
          while (input.value.includes(",")) {
            input.value = input.value.replace(",", "");
            c--;
            i++;
            if (i > 25) break;
          }
          input.setSelectionRange(c, c);
        });
      }

      input.addEventListener("change", () => {
        window.setNt4(
          "/OxConfig/ClassSetter",
          "single," + parameters[i][1] + "," + this.EDIT_MODE_DROPDOWN.value + "," + input.value
        );
      });
      td2.appendChild(input);
      tr.appendChild(td1);
      tr.appendChild(td2);
      this.PARAMETER_TABLE.appendChild(tr);
    }
  }

  private reloadControllerList() {
    this.loadModes();

    let controllers = getOrDefault(window.log, "NT:/OxConfig/Classes", LoggableType.String, Infinity, "");
    if (controllers == "") {
      this.CONTROLLER_DROPDOWN.innerHTML = "";
      this.controllerList = [];
      let option = document.createElement("option");
      option.value = "failed";
      option.innerText = "Failed to retrieve list";
      this.CONTROLLER_DROPDOWN.appendChild(option);
      return;
    }
    if (controllers == JSON.stringify(this.controllerList)) return;
    this.hasLoaded = true;
    this.CONTROLLER_DROPDOWN.innerHTML = "";
    let controllerList;
    try {
      controllerList = JSON.parse(controllers);
    } catch (e) {
      let option = document.createElement("option");
      option.value = "failed";
      option.innerText = "Failed to parse list";
      this.CONTROLLER_DROPDOWN.appendChild(option);
      return;
    }
    this.controllerList = controllerList;

    for (let controller of controllerList) {
      let option = document.createElement("option");
      option.value = controller[1];
      option.innerText = controller[0];
      this.CONTROLLER_DROPDOWN.appendChild(option);
    }
    if (controllerList.find((c: any) => c[1] == this.curController) != null) {
      this.showController(this.curController);
      this.CONTROLLER_DROPDOWN.value = this.curController;
    } else {
      this.showController(controllerList[0][1]);
      this.curController = controllerList[0][1];
    }
  }

  /** Processes a drag event, including adding a field if necessary. */
  private handleDrag(dragData: any) {
    if (this.CONTENT.hidden) return;
    [
      {
        legend: "left",
        element: this.LEFT_LIST,
        target: this.LEFT_DRAG_TARGET,
        normalTypes: [LoggableType.Number],
        arrayTypes: [LoggableType.NumberArray]
      },
      {
        legend: "discrete",
        element: this.DISCRETE_LIST,
        target: this.DISCRETE_DRAG_TARGET,
        normalTypes: [
          LoggableType.Raw,
          LoggableType.Boolean,
          LoggableType.Number,
          LoggableType.String,
          LoggableType.BooleanArray,
          LoggableType.NumberArray,
          LoggableType.StringArray
        ],
        arrayTypes: []
      },
      {
        legend: "right",
        element: this.RIGHT_LIST,
        target: this.RIGHT_DRAG_TARGET,
        normalTypes: [LoggableType.Number],
        arrayTypes: [LoggableType.NumberArray]
      }
    ].forEach((data) => {
      let legend = data.legend as "left" | "discrete" | "right";
      let element = data.element;
      let target = data.target;
      let normalTypes = data.normalTypes;
      let arrayTypes = data.arrayTypes;

      // Check if active and valid type
      let rect = element.getBoundingClientRect();
      let active =
        dragData.x > rect.left && dragData.x < rect.right && dragData.y > rect.top && dragData.y < rect.bottom;
      let validType = false;
      dragData.data.fields.forEach((key: string) => {
        let type = window.log.getType(key) as LoggableType;
        if (normalTypes.includes(type)) {
          validType = true;
        }
        if (arrayTypes.includes(type)) {
          validType = true;
        }
      });
      if (
        dragData.data.children.length > 0 &&
        dragData.data.children.some((childKey: string) => {
          let childType = window.log.getType(childKey);
          return childType !== null && normalTypes.includes(childType);
        })
      ) {
        validType = true;
      }

      // Add field
      if (dragData.end) {
        target.hidden = true;
        if (active && validType) {
          dragData.data.fields.forEach((key: string) => {
            let type = window.log.getType(key) as LoggableType;
            if (normalTypes.includes(type)) {
              this.addField(legend, key);
            } else {
              dragData.data.children.forEach((childKey: string) => {
                let childType = window.log.getType(childKey);
                if (childType !== null && normalTypes.includes(childType)) {
                  this.addField(legend, childKey);
                }
              });
            }
          });
        }
      } else {
        target.hidden = !(active && validType);
      }
    });
  }

  /** Adds a new field. */
  private addField(legend: "left" | "discrete" | "right", key: string, color?: string, show: boolean = true) {
    // Get color if not provided
    if (color !== null) {
      let usedColors: string[] = [];
      [this.leftFields, this.discreteFields, this.rightFields].forEach((legend) => {
        legend.forEach((field) => {
          usedColors.push(field.color);
        });
      });
      let availableColors = AllColors.filter((color) => !usedColors.includes(color));
      if (availableColors.length === 0) {
        color = AllColors[Math.floor(Math.random() * AllColors.length)];
      } else {
        color = availableColors[0];
      }
    }

    // Find field list
    let fieldList = {
      left: this.leftFields,
      discrete: this.discreteFields,
      right: this.rightFields
    }[legend];

    // Create element
    let isFound = window.log.getFieldKeys().includes(key);
    let itemElement = this.LEGEND_ITEM_TEMPLATE.cloneNode(true) as HTMLElement;
    let splotchElement = itemElement.getElementsByClassName("legend-splotch")[0] as HTMLElement;
    let keyElement = itemElement.getElementsByClassName("legend-key")[0] as HTMLElement;
    let removeElement = itemElement.getElementsByClassName("legend-edit")[0] as HTMLElement;

    itemElement.title = key;
    keyElement.innerText = key;
    if (!isFound) keyElement.style.textDecoration = "line-through";

    splotchElement.style.fill = color;
    itemElement.getElementsByClassName("legend-splotch")[0].addEventListener("click", () => {
      if (!itemElement.parentElement) return;
      let index = Array.from(itemElement.parentElement.children).indexOf(itemElement) - 1;
      let show = !fieldList[index].show;
      fieldList[index].show = show;
      splotchElement.style.fill = show ? (color as string) : "transparent";
    });
    splotchElement.style.fill = show ? color : "transparent";

    removeElement.title = "";
    removeElement.addEventListener("click", () => {
      if (!itemElement.parentElement) return;
      let index = Array.from(itemElement.parentElement.children).indexOf(itemElement) - 1;
      itemElement.parentElement.removeChild(itemElement);
      fieldList.splice(index, 1);
    });

    // Add field
    fieldList.push({
      key: key,
      color: color,
      show: show
    });
    switch (legend) {
      case "left":
        this.LEFT_LIST.appendChild(itemElement);
        break;
      case "discrete":
        this.DISCRETE_LIST.appendChild(itemElement);
        break;
      case "right":
        this.RIGHT_LIST.appendChild(itemElement);
        break;
    }
  }

  getActiveFields(): string[] {
    return [
      "NT:/OxConfig/Classes",
      "NT:/OxConfig/Modes",
      "NT:/OxConfig/CurrentMode",
      "NT:/OxConfig/Raw",
      ...this.leftFields.map((field) => field.key),
      ...this.discreteFields.map((field) => field.key),
      ...this.rightFields.map((field) => field.key)
    ];
  }

  /** Apply the scroll and update the timestamp range. */
  private updateScroll(dx: number = 0, dy: number = 0) {
    // Find available timestamp range
    let availableRange = window.log.getTimestampRange();
    availableRange = [availableRange[0], availableRange[1]];
    let liveTime = window.selection.getCurrentLiveTime();
    if (liveTime !== null) {
      availableRange[1] = liveTime;
    }
    if (availableRange[1] - availableRange[0] < this.MIN_ZOOM_TIME) {
      availableRange[1] = availableRange[0] + this.MIN_ZOOM_TIME;
    }

    // Apply horizontal scroll
    if (window.selection.getMode() === SelectionMode.Locked) {
      let zoom = this.timestampRange[1] - this.timestampRange[0];
      this.timestampRange[0] = availableRange[1] - zoom;
      this.timestampRange[1] = availableRange[1];
      if (dx < 0) window.selection.unlock(); // Unlock if attempting to scroll away
    } else if (dx !== 0) {
      let secsPerPixel = (this.timestampRange[1] - this.timestampRange[0]) / this.SCROLL_OVERLAY.clientWidth;
      this.timestampRange[0] += dx * secsPerPixel;
      this.timestampRange[1] += dx * secsPerPixel;
    }

    // Apply vertical scroll
    if (dy !== 0 && (!this.maxZoom || dy < 0)) {
      // If max zoom, ignore positive scroll (no effect, just apply the max zoom)
      let zoomPercent = Math.pow(this.ZOOM_BASE, dy);
      let newZoom = (this.timestampRange[1] - this.timestampRange[0]) * zoomPercent;
      if (newZoom < this.MIN_ZOOM_TIME) newZoom = this.MIN_ZOOM_TIME;
      if (newZoom > availableRange[1] - availableRange[0]) newZoom = availableRange[1] - availableRange[0];

      let hoveredTime = window.selection.getHoveredTime();
      if (hoveredTime !== null) {
        let hoveredPercent = (hoveredTime - this.timestampRange[0]) / (this.timestampRange[1] - this.timestampRange[0]);
        this.timestampRange[0] = hoveredTime - newZoom * hoveredPercent;
        this.timestampRange[1] = hoveredTime + newZoom * (1 - hoveredPercent);
      }
    } else if (this.maxZoom) {
      this.timestampRange = availableRange;
    }

    // Enforce max range
    if (this.timestampRange[1] - this.timestampRange[0] > availableRange[1] - availableRange[0]) {
      this.timestampRange = availableRange;
    }
    this.maxZoom = this.timestampRange[1] - this.timestampRange[0] === availableRange[1] - availableRange[0];

    // Enforce left limit
    if (this.timestampRange[0] < availableRange[0]) {
      let shift = availableRange[0] - this.timestampRange[0];
      this.timestampRange[0] += shift;
      this.timestampRange[1] += shift;
    }

    // Enforce right limit
    if (this.timestampRange[1] > availableRange[1]) {
      let shift = availableRange[1] - this.timestampRange[1];
      this.timestampRange[0] += shift;
      this.timestampRange[1] += shift;
      if (dx > 0) window.selection.lock(); // Lock if action is intentional
    }
  }

  /** Adjusts the range to fit the extreme limits. */
  private limitAxisRange(range: [number, number]): [number, number] {
    let adjustedRange = [range[0], range[1]] as [number, number];
    if (adjustedRange[0] > this.MAX_VALUE) {
      adjustedRange[0] = this.MAX_VALUE;
    }
    if (adjustedRange[1] > this.MAX_VALUE) {
      adjustedRange[1] = this.MAX_VALUE;
    }
    if (adjustedRange[0] < -this.MAX_VALUE) {
      adjustedRange[0] = -this.MAX_VALUE;
    }
    if (adjustedRange[1] < -this.MAX_VALUE) {
      adjustedRange[1] = -this.MAX_VALUE;
    }
    if (adjustedRange[0] === adjustedRange[1]) {
      if (Math.abs(adjustedRange[0]) >= this.MAX_VALUE) {
        if (adjustedRange[0] > 0) {
          adjustedRange[0] *= 0.8;
        } else {
          adjustedRange[1] *= 0.8;
        }
      } else {
        adjustedRange[0]--;
        adjustedRange[1]++;
      }
    }
    if (adjustedRange[1] - adjustedRange[0] > this.MAX_AXIS_RANGE) {
      if (adjustedRange[0] + this.MAX_AXIS_RANGE < this.MAX_VALUE) {
        adjustedRange[1] = adjustedRange[0] + this.MAX_AXIS_RANGE;
      } else {
        adjustedRange[0] = adjustedRange[1] - this.MAX_AXIS_RANGE;
      }
    }
    if (adjustedRange[1] - adjustedRange[0] < this.MIN_AXIS_RANGE) {
      adjustedRange[1] = adjustedRange[0] + this.MIN_AXIS_RANGE;
    }
    return adjustedRange;
  }

  /**
   * Calculates appropriate bounds and steps based on data.
   * @param primaryAxis The config from another axis (gridlines will be aligned).
   * @param sizePx (If no primary axis) The available size on the graph
   * @param targetStepPx (If no primary axis) The optimal size of each step
   *
   * @param lockedRange Always use this range instead of the automatic version
   * @param valueRange (If not locked) The range of values that are visible in the current timestamp range
   * @param marginProportion (If not locked) The size of the margin above and below visible data
   *
   * @param customUnit The multiplier for an extra unit that can be used for large values (e.g. 60 for minutes)
   *
   * @returns The parameters for the axis.
   */
  private calcAutoAxis(
    primaryAxis: AxisConfig | null,
    sizePx: number | null,
    targetStepPx: number | null,
    lockedRange: [number, number] | null,
    valueRange: [number, number] | null,
    marginProportion: number | null,
    customUnit: number = 1
  ): AxisConfig {
    // Calc target range
    let targetRange: [number, number] = [0, 1];
    if (lockedRange !== null) {
      targetRange = this.limitAxisRange(lockedRange);
    } else if (valueRange !== null && marginProportion !== null) {
      let adjustedRange = this.limitAxisRange(valueRange);
      let margin = (adjustedRange[1] - adjustedRange[0]) * marginProportion;
      targetRange = [adjustedRange[0] - margin, adjustedRange[1] + margin];
    }

    // How many steps?
    let stepCount: number = 1;
    if (primaryAxis !== null) {
      stepCount = (primaryAxis.max - primaryAxis.min) / primaryAxis.step;
    } else if (sizePx !== null && targetStepPx !== null) {
      stepCount = sizePx / targetStepPx;
    }
    let stepValueApprox = (targetRange[1] - targetRange[0]) / stepCount;

    // Clean up step size
    let useCustomUnit = customUnit !== null && stepValueApprox > customUnit;
    let roundBase;
    if (useCustomUnit) {
      roundBase = customUnit * 10 ** Math.floor(Math.log10(stepValueApprox / customUnit));
    } else {
      roundBase = 10 ** Math.floor(Math.log10(stepValueApprox));
    }
    let multiplierLookup: number[];
    if (primaryAxis === null) {
      multiplierLookup = [0, 1, 2, 2, 5, 5, 5, 5, 5, 10, 10]; // Use friendly numbers if possible
    } else {
      multiplierLookup = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // Use all numbers to get a better fit
    }
    let stepValue = roundBase * multiplierLookup[Math.round(stepValueApprox / roundBase)];

    // Adjust to match primary gridlines
    if (primaryAxis !== null) {
      let midPrimary = (primaryAxis.min + primaryAxis.max) / 2;
      let midSecondary = (targetRange[0] + targetRange[1]) / 2;
      let midStepPrimary = Math.ceil(cleanFloat(midPrimary / primaryAxis.step)) * primaryAxis.step;
      let midStepSecondary = Math.ceil(cleanFloat(midSecondary / stepValue)) * stepValue;

      let newMin = ((primaryAxis.min - midStepPrimary) / primaryAxis.step) * stepValue + midStepSecondary;
      let newMax = ((primaryAxis.max - midStepPrimary) / primaryAxis.step) * stepValue + midStepSecondary;
      return {
        min: newMin,
        max: newMax,
        step: stepValue,
        unit: useCustomUnit ? customUnit : 1
      };
    } else {
      return {
        min: targetRange[0],
        max: targetRange[1],
        step: stepValue,
        unit: useCustomUnit ? customUnit : 1
      };
    }
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

    if (this.curDeployDir != null) {
      let split = getOrDefault(window.log, "NT:/OxConfig/Raw", LoggableType.String, Infinity, "");
      if (split != "") {
        split = split.split(",");
        if (split[0] != this.oldRawTimestamp) {
          this.oldRawTimestamp = split.shift();
          window.writeOxConfig(this.curDeployDir, this.oldRawTimestamp, split.join(","));
        }
      }
    }
    // Scroll sensor periodic
    this.scrollSensor.periodic();

    // Update to ensure smoothness when locked
    this.updateScroll(0, 0);

    // Calculate initial setup and scaling
    const devicePixelRatio = window.devicePixelRatio;
    let context = this.CANVAS.getContext("2d") as CanvasRenderingContext2D;
    let width = this.CANVAS_CONTAINER.clientWidth;
    let height = this.CANVAS_CONTAINER.clientHeight;
    let light = !window.matchMedia("(prefers-color-scheme: dark)").matches;

    // Exit if render state unchanged
    let renderState: any[] = [
      width,
      height,
      light,
      devicePixelRatio,
      this.timestampRange,
      this.lastCursorX,
      this.refreshCount,
      this.leftFields,
      this.discreteFields,
      this.rightFields,
      window.selection.getMode(),
      window.selection.getSelectedTime(),
      window.selection.getHoveredTime()
    ];
    let renderStateString = JSON.stringify(renderState);
    if (renderStateString === this.lastRenderState) {
      return;
    }
    this.lastRenderState = renderStateString;

    // Apply initial setup and scaling
    this.CANVAS.width = width * devicePixelRatio;
    this.CANVAS.height = height * devicePixelRatio;
    context.scale(devicePixelRatio, devicePixelRatio);
    context.clearRect(0, 0, width, height);
    context.font = "12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont";

    // Cache data for all fields
    let dataCache: { [id: string]: LogValueSetAny } = {};
    let typeCache: { [id: string]: LoggableType } = {};
    let leftRange: [number, number] = [-1, 1];
    let rightRange: [number, number] = [-1, 1];

    let availableKeys = window.log.getFieldKeys();
    [this.leftFields, this.discreteFields, this.rightFields].forEach((array, legendIndex) => {
      let range: [number, number] = [Infinity, -Infinity];
      array.forEach((field) => {
        if (!field.show || !availableKeys.includes(field.key)) return;

        // Read data for field
        if (!Object.keys(dataCache).includes(field.key)) {
          let logData = window.log.getRange(
            field.key,
            this.timestampRange[0],
            this.timestampRange[1]
          ) as LogValueSetAny;
          if (
            logData.timestamps.length > 0 &&
            logData.timestamps[logData.timestamps.length - 1] > this.timestampRange[1]
          ) {
            // Last value is after end of timestamp range
            logData.timestamps.pop();
            logData.values.pop();
          }
          dataCache[field.key] = logData;
          typeCache[field.key] = window.log.getType(field.key) as LoggableType;
        }

        // Update range for left & right legends
        if (legendIndex !== 1 && typeCache[field.key] === LoggableType.Number) {
          if (
            dataCache[field.key].timestamps.length === 1 &&
            dataCache[field.key].timestamps[0] > this.timestampRange[1]
          ) {
            return; // Not displayed
          }

          (dataCache[field.key] as LogValueSetNumber).values.forEach((value) => {
            if (legendIndex === 0) value = convertWithPreset(value, this.leftUnitConversion);
            if (legendIndex === 2) value = convertWithPreset(value, this.rightUnitConversion);
            if (value < range[0]) range[0] = value;
            if (value > range[1]) range[1] = value;
          });
        }
      });

      // Save range
      if (!isFinite(range[0])) range[0] = -1;
      if (!isFinite(range[1])) range[1] = 1;
      if (legendIndex === 0) leftRange = range;
      if (legendIndex === 2) rightRange = range;
    });

    let visibleFieldsLeft = this.leftFields.filter((field) => field.show && Object.keys(dataCache).includes(field.key));
    let visibleFieldsDiscrete = this.discreteFields.filter(
      (field) => field.show && Object.keys(dataCache).includes(field.key)
    );
    let visibleFieldsRight = this.rightFields.filter(
      (field) => field.show && Object.keys(dataCache).includes(field.key)
    );

    // Calculate vertical layout for graph (based on discrete fields)
    let graphTop = 8;
    let graphHeight = height - graphTop - 50;
    if (graphHeight < 1) graphHeight = 1;
    let graphHeightOpen = graphHeight - visibleFieldsDiscrete.length * 20 - (visibleFieldsDiscrete.length > 0 ? 5 : 0);
    if (graphHeightOpen < 1) graphHeightOpen = 1;

    // Calculate y axes
    const TARGET_STEP_PX = 50;
    const PRIMARY_MARGIN = 0.05;
    const SECONDARY_MARGIN = 0.3;
    let showLeftAxis = visibleFieldsLeft.length > 0 || this.leftLockedRange !== null;
    let showRightAxis = visibleFieldsRight.length > 0 || this.rightLockedRange !== null;
    if (!showLeftAxis && !showRightAxis) showLeftAxis = true;
    let leftIsPrimary = this.leftLockedRange !== null;
    let rightIsPrimary = this.rightLockedRange !== null;
    if (!leftIsPrimary && !rightIsPrimary) {
      if (visibleFieldsRight.length > visibleFieldsLeft.length) {
        rightIsPrimary = true;
      } else {
        leftIsPrimary = true;
      }
    }
    let leftAxis: AxisConfig;
    let rightAxis: AxisConfig;
    if (leftIsPrimary && rightIsPrimary) {
      leftAxis = this.calcAutoAxis(
        null,
        graphHeightOpen,
        TARGET_STEP_PX,
        this.leftLockedRange,
        leftRange,
        PRIMARY_MARGIN
      );
      rightAxis = this.calcAutoAxis(
        null,
        graphHeightOpen,
        TARGET_STEP_PX,
        this.rightLockedRange,
        rightRange,
        PRIMARY_MARGIN
      );
    } else if (leftIsPrimary && !rightIsPrimary) {
      leftAxis = this.calcAutoAxis(
        null,
        graphHeightOpen,
        TARGET_STEP_PX,
        this.leftLockedRange,
        leftRange,
        PRIMARY_MARGIN
      );
      rightAxis = this.calcAutoAxis(leftAxis, null, null, this.rightLockedRange, rightRange, SECONDARY_MARGIN);
    } else {
      rightAxis = this.calcAutoAxis(
        null,
        graphHeightOpen,
        TARGET_STEP_PX,
        this.rightLockedRange,
        rightRange,
        PRIMARY_MARGIN
      );
      leftAxis = this.calcAutoAxis(rightAxis, null, null, this.leftLockedRange, leftRange, SECONDARY_MARGIN);
    }
    this.leftRenderedRange = [leftAxis.min, leftAxis.max];
    this.rightRenderedRange = [rightAxis.min, rightAxis.max];

    // Calculate horizontal layout for graph
    let getTextWidth = (config: AxisConfig): number => {
      let length = 0;
      let value = Math.floor(config.max / config.step) * config.step;
      while (value > config.min) {
        length = Math.max(length, context.measureText(cleanFloat(value).toString()).width);
        value -= config.step;
      }
      return Math.ceil(length / 10) * 10;
    };
    let graphLeft = 25 + (showLeftAxis ? getTextWidth(leftAxis) : 0);
    let graphRight = 25 + (showRightAxis ? getTextWidth(rightAxis) : 0);
    let graphWidth = width - graphLeft - graphRight;
    if (graphWidth < 1) graphWidth = 1;

    // Calculate x axis
    let xAxis = this.calcAutoAxis(null, graphWidth, 100, null, this.timestampRange, 0, 60);

    // Update hovered time based on graph layout
    if (this.lastCursorX === null || this.lastCursorX < graphLeft || this.lastCursorX > graphLeft + graphWidth) {
      window.selection.setHoveredTime(null);
    } else {
      window.selection.setHoveredTime(
        scaleValue(this.lastCursorX, [graphLeft, graphLeft + graphWidth], this.timestampRange)
      );
    }

    // Update scroll layout
    this.SCROLL_OVERLAY.style.left = graphLeft.toString() + "px";
    this.SCROLL_OVERLAY.style.right = graphRight.toString() + "px";

    // Render discrete data
    context.globalAlpha = 1;
    context.textAlign = "left";
    context.textBaseline = "middle";
    visibleFieldsDiscrete.forEach((field, renderIndex) => {
      let type = typeCache[field.key];
      let data = dataCache[field.key];

      let isDark = window.log.getTimestamps([field.key]).indexOf(data.timestamps[0]) % 2 === 0;
      isDark = isDark !== window.log.getStripingReference(field.key);
      for (let i = 0; i < data.timestamps.length; i++) {
        let startX = scaleValue(data.timestamps[i], this.timestampRange, [graphLeft, graphLeft + graphWidth]);
        let endX: number;
        if (i === data.timestamps.length - 1) {
          endX = graphLeft + graphWidth;
        } else {
          endX = scaleValue(data.timestamps[i + 1], this.timestampRange, [graphLeft, graphLeft + graphWidth]);
        }
        if (endX > graphLeft + graphWidth) endX = graphLeft + graphWidth;
        let topY = graphTop + graphHeight - 20 - renderIndex * 20;

        // Draw rectangle
        isDark = !isDark;
        if (type === LoggableType.Boolean) isDark = data.values[i];
        context.fillStyle = isDark ? shiftColor(field.color, -30) : shiftColor(field.color, 30);
        context.fillRect(startX, topY, endX - startX, 15);

        // Draw text
        let adjustedStartX = startX < graphLeft ? graphLeft : startX;
        if (endX - adjustedStartX > 10) {
          let text = getLogValueText(data.values[i], type);
          context.fillStyle = isDark ? shiftColor(field.color, 130) : shiftColor(field.color, -130);
          context.fillText(text, adjustedStartX + 5, topY + 15 / 2, endX - adjustedStartX - 10);
        }
      }
    });

    // Render continuous data
    const xScaler = new ValueScaler(this.timestampRange, [graphLeft, graphLeft + graphWidth]);
    [
      { fields: visibleFieldsLeft, axis: leftAxis, unitConversion: this.leftUnitConversion },
      { fields: visibleFieldsRight, axis: rightAxis, unitConversion: this.rightUnitConversion }
    ].forEach((set) => {
      set.fields.forEach((field) => {
        let data: LogValueSetNumber = dataCache[field.key];
        let axis = set.axis;
        let unitConversion = set.unitConversion;
        const yScaler = new ValueScaler([axis.min, axis.max], [graphTop + graphHeightOpen, graphTop]);
        context.lineWidth = 1;
        context.strokeStyle = field.color;
        context.beginPath();

        // Render starting point
        context.moveTo(
          graphLeft + graphWidth,
          yScaler.calculate(
            clampValue(
              convertWithPreset(data.values[data.values.length - 1], unitConversion),
              -this.MAX_VALUE,
              this.MAX_VALUE
            )
          )
        );

        // Render main data
        let i = data.values.length - 1;
        while (true) {
          let x = xScaler.calculate(data.timestamps[i]);

          // Render start of current data point
          let convertedValue = clampValue(
            convertWithPreset(data.values[i], unitConversion),
            -this.MAX_VALUE,
            this.MAX_VALUE
          );
          context.lineTo(x, yScaler.calculate(convertedValue));

          // Find previous data point and vertical range
          let currentX = Math.floor(x * devicePixelRatio);
          let newX = currentX;
          let vertRange = [convertedValue, convertedValue];
          do {
            i--;
            let convertedValue = clampValue(
              convertWithPreset(data.values[i], unitConversion),
              -this.MAX_VALUE,
              this.MAX_VALUE
            );
            if (convertedValue < vertRange[0]) vertRange[0] = convertedValue;
            if (convertedValue > vertRange[1]) vertRange[1] = convertedValue;
            newX = Math.floor(xScaler.calculate(data.timestamps[i]) * devicePixelRatio);
          } while (i >= 0 && newX >= currentX); // Compile values to vertical range until the pixel changes
          if (i < 0) break;

          // Render vertical range
          context.moveTo(x, yScaler.calculate(vertRange[0]));
          context.lineTo(x, yScaler.calculate(vertRange[1]));

          // Move to end of previous data point
          context.moveTo(
            x,
            yScaler.calculate(
              clampValue(convertWithPreset(data.values[i], unitConversion), -this.MAX_VALUE, this.MAX_VALUE)
            )
          );
        }
        context.stroke();
      });
    });

    //Use similar logic as main axes but with an extra decimal point of precision to format the popup timestamps
    let formatMarkedTimestampText = (time: number): string => {
      let fractionDigits = Math.max(0, -Math.floor(Math.log10(xAxis.step / 10)));
      return time.toFixed(fractionDigits) + "s";
    };

    // Write formatted timestamp popups to graph view
    let writeCenteredTime = (text: string, x: number, alpha: number, drawRect: boolean) => {
      context.globalAlpha = alpha;
      context.strokeStyle = light ? "#222" : "#eee";
      context.fillStyle = light ? "#222" : "#eee";
      let textSize = context.measureText(text);
      context.clearRect(
        x - textSize.actualBoundingBoxLeft - 5,
        graphTop,
        textSize.width + 10,
        textSize.actualBoundingBoxDescent + 10
      );
      if (drawRect) {
        context.strokeRect(
          x - textSize.actualBoundingBoxLeft - 5,
          graphTop,
          textSize.width + 10,
          textSize.actualBoundingBoxDescent + 10
        );
      }

      context.fillText(text, x, graphTop + 5);
      context.globalAlpha = 1;
    };

    // Draw a vertical dotted line at the time
    let markTime = (time: number, alpha: number) => {
      if (time >= this.timestampRange[0] && time <= this.timestampRange[1]) {
        context.globalAlpha = alpha;
        context.lineWidth = 1;
        context.setLineDash([5, 5]);
        context.strokeStyle = light ? "#222" : "#eee";
        context.fillStyle = light ? "#222" : "#eee";

        let x = scaleValue(time, this.timestampRange, [graphLeft, graphLeft + graphWidth]);
        context.beginPath();
        context.moveTo(x, graphTop);
        context.lineTo(x, graphTop + graphHeight);
        context.stroke();
        context.setLineDash([]);
        context.globalAlpha = 1;
      }
    };

    // Render selected times
    context.textBaseline = "top";
    context.textAlign = "center";
    let selectionMode = window.selection.getMode();
    let selectedTime = window.selection.getSelectedTime();
    let hoveredTime = window.selection.getHoveredTime();
    let selectedX =
      selectedTime === null ? null : scaleValue(selectedTime, this.timestampRange, [graphLeft, graphLeft + graphWidth]);
    let hoveredX =
      hoveredTime === null ? null : scaleValue(hoveredTime, this.timestampRange, [graphLeft, graphLeft + graphWidth]);
    let selectedText = selectedTime === null ? null : formatMarkedTimestampText(selectedTime);
    let hoveredText = hoveredTime === null ? null : formatMarkedTimestampText(hoveredTime);
    if (hoveredTime !== null) markTime(hoveredTime!, 0.35);
    if (selectionMode === SelectionMode.Static || selectionMode === SelectionMode.Playback) {
      // There is a valid selected time
      selectedTime = selectedTime as number;
      selectedX = selectedX as number;
      selectedText = selectedText as string;
      markTime(selectedTime!, 1);
      if (hoveredTime !== null && hoveredTime !== selectedTime) {
        // Write both selected and hovered time, figure out layout
        hoveredTime = hoveredTime as number;
        hoveredX = hoveredX as number;
        hoveredText = hoveredText as string;

        let deltaText = "\u0394" + formatMarkedTimestampText(hoveredTime - selectedTime);
        let xSpace = clampValue(selectedX, graphLeft, graphLeft + graphWidth) - hoveredX;
        let textHalfWidths =
          (context.measureText(selectedText).width + 10) / 2 + (context.measureText(hoveredText).width + 10) / 2 + 4;
        let deltaTextMetrics = context.measureText(deltaText);
        let deltaWidth = deltaTextMetrics.width + 10 + 4;
        let offsetAmount = textHalfWidths - Math.abs(xSpace);
        let doesDeltaFit = deltaWidth <= Math.abs(xSpace);
        if (doesDeltaFit) {
          // Enough space for delta text
          offsetAmount = textHalfWidths + deltaWidth - Math.abs(xSpace);

          // Draw connecting line between two cursors, overlapping parts will be automatically cleared
          let centerY = (deltaTextMetrics.actualBoundingBoxDescent + 10) / 2 + graphTop;
          context.globalAlpha = 0.35;
          context.lineWidth = 1;
          context.setLineDash([]);
          context.strokeStyle = light ? "#222" : "#eee";
          context.beginPath();
          context.moveTo(selectedX, centerY);
          context.lineTo(hoveredX, centerY);
          context.stroke();
          context.globalAlpha = 1;

          // Draw delta text
          let deltaX = (selectedX + hoveredX) / 2;
          if (selectedTime < this.timestampRange[0]) {
            deltaX = Math.max(deltaX, graphLeft + deltaWidth / 2 - 2);
          } else if (selectedTime > this.timestampRange[1]) {
            deltaX = Math.min(deltaX, graphLeft + graphWidth - deltaWidth / 2 + 2);
          }
          writeCenteredTime(deltaText, deltaX, 0.35, false);
        }
        if (offsetAmount > 0) {
          selectedX = selectedX + (offsetAmount / 2) * (selectedX < hoveredX ? -1 : 1);
          hoveredX = hoveredX - (offsetAmount / 2) * (selectedX < hoveredX ? -1 : 1);
        }
        writeCenteredTime(selectedText, selectedX, 1, true);
        writeCenteredTime(hoveredText, hoveredX, 0.35, true);
      } else {
        // No valid hovered time, only write selected time
        writeCenteredTime(selectedText, selectedX, 1, true);
      }
    } else if (hoveredTime !== null) {
      // No valid selected time, only write hovered time
      writeCenteredTime(hoveredText!, hoveredX!, 0.35, true);
    }

    // Clear overflow & draw graph outline
    context.lineWidth = 1;
    context.strokeStyle = light ? "#222" : "#eee";
    context.clearRect(0, 0, width, graphTop);
    context.clearRect(0, graphTop + graphHeight, width, height - graphTop - graphHeight);
    context.clearRect(0, graphTop, graphLeft, graphHeight);
    context.clearRect(graphLeft + graphWidth, graphTop, width - graphLeft - graphWidth, graphHeight);
    context.strokeRect(graphLeft, graphTop, graphWidth, graphHeight);

    // Render y axes
    context.lineWidth = 1;
    context.strokeStyle = light ? "#222" : "#eee";
    context.fillStyle = light ? "#222" : "#eee";
    context.textBaseline = "middle";

    if (showLeftAxis) {
      context.textAlign = "right";
      let stepPos = Math.floor(leftAxis.max / leftAxis.step) * leftAxis.step;
      while (true) {
        let y = scaleValue(stepPos, [leftAxis.min, leftAxis.max], [graphTop + graphHeightOpen, graphTop]);
        if (y > graphTop + graphHeight) break;

        context.globalAlpha = 1;
        if (Math.abs(stepPos) < this.MAX_DECIMAL_VALUE || stepPos % 1 === 0) {
          let value = Math.abs(stepPos) < this.MAX_DECIMAL_VALUE ? cleanFloat(stepPos) : Math.round(stepPos);
          context.fillText(value.toString(), graphLeft - 15, y);
          context.beginPath();
          context.moveTo(graphLeft, y);
          context.lineTo(graphLeft - 5, y);
          context.stroke();
        }

        if (leftIsPrimary) {
          context.globalAlpha = 0.1;
          context.beginPath();
          context.moveTo(graphLeft, y);
          context.lineTo(graphLeft + graphWidth, y);
          context.stroke();
        }

        stepPos -= leftAxis.step;
      }
    }

    if (showRightAxis) {
      context.textAlign = "left";
      let stepPos = Math.floor(rightAxis.max / rightAxis.step) * rightAxis.step;
      while (true) {
        let y = scaleValue(stepPos, [rightAxis.min, rightAxis.max], [graphTop + graphHeightOpen, graphTop]);
        if (y > graphTop + graphHeight) break;

        context.globalAlpha = 1;
        if (Math.abs(stepPos) < this.MAX_DECIMAL_VALUE || stepPos % 1 === 0) {
          let value = Math.abs(stepPos) < this.MAX_DECIMAL_VALUE ? cleanFloat(stepPos) : Math.round(stepPos);
          context.fillText(value.toString(), graphLeft + graphWidth + 15, y);
          context.beginPath();
          context.moveTo(graphLeft + graphWidth, y);
          context.lineTo(graphLeft + graphWidth + 5, y);
          context.stroke();
        }

        if (!leftIsPrimary) {
          context.globalAlpha = 0.1;
          context.beginPath();
          context.moveTo(graphLeft, y);
          context.lineTo(graphLeft + graphWidth, y);
          context.stroke();
        }

        stepPos -= rightAxis.step;
      }
    }

    // Render x axis
    context.textAlign = "center";
    let stepPos = Math.ceil(cleanFloat(xAxis.min / xAxis.step)) * xAxis.step;
    while (true) {
      let x = scaleValue(stepPos, [xAxis.min, xAxis.max], [graphLeft, graphLeft + graphWidth]);

      // Clean up final x (scroll can cause rounding problems)
      if (x - graphLeft - graphWidth > 1) {
        break;
      } else if (x - graphLeft - graphWidth > 0) {
        x = graphLeft + graphWidth;
      }

      let text = cleanFloat(stepPos / xAxis.unit).toString() + (xAxis.unit === 60 ? "m" : "s");

      context.globalAlpha = 1;
      context.fillText(text, x, graphTop + graphHeight + 15);
      context.beginPath();
      context.moveTo(x, graphTop + graphHeight);
      context.lineTo(x, graphTop + graphHeight + 5);
      context.stroke();

      context.globalAlpha = 0.1;
      context.beginPath();
      context.moveTo(x, graphTop);
      context.lineTo(x, graphTop + graphHeight);
      context.stroke();

      stepPos += xAxis.step;
    }

    // Update value preview
    let previewTime: number | null = null;
    if (selectionMode === SelectionMode.Playback || selectionMode === SelectionMode.Locked) {
      previewTime = selectedTime as number;
    } else if (hoveredTime !== null) {
      previewTime = hoveredTime;
    } else if (selectedTime !== null) {
      previewTime = selectedTime;
    }
    [
      [this.LEFT_LIST, this.leftFields],
      [this.DISCRETE_LIST, this.discreteFields],
      [this.RIGHT_LIST, this.rightFields]
    ].forEach((fieldData, legendIndex) => {
      let parentElement = fieldData[0] as HTMLElement;
      let fieldList = fieldData[1] as {
        key: string;
        color: string;
        show: boolean;
      }[];
      Array.from(parentElement.children).forEach((itemElement, index) => {
        if (index === 0) return;
        let valueElement = itemElement.getElementsByClassName("legend-value")[0] as HTMLElement;
        let key = fieldList[index - 1].key;
        let hasValue = false;
        if (previewTime !== null && availableKeys.includes(key)) {
          let currentData = window.log.getRange(key, previewTime, previewTime);
          if (currentData && currentData.timestamps.length > 0 && currentData.timestamps[0] <= previewTime) {
            let value = currentData.values[0];
            if (legendIndex === 0) value = convertWithPreset(value, this.leftUnitConversion);
            if (legendIndex === 2) value = convertWithPreset(value, this.rightUnitConversion);
            let text = getLogValueText(value, window.log.getType(key)!);
            if (text !== valueElement.innerText) valueElement.innerText = text;
            hasValue = true;
          }
        }

        if (previewTime !== null && availableKeys.includes(key) && hasValue) {
          itemElement.classList.add("legend-item-with-value");
        } else {
          itemElement.classList.remove("legend-item-with-value");
        }
      });
    });
  }

  private loadModes() {
    let modesRaw = getOrDefault(window.log, "NT:/OxConfig/Modes", LoggableType.String, Infinity, "");
    if (modesRaw != "") {
      let tempModes = modesRaw.split(",");
      if (tempModes.length > 0 && JSON.stringify(this.modes) != JSON.stringify(tempModes)) {
        this.modes = tempModes;
        this.CUR_MODE_DROPDOWN.innerHTML = "";
        this.EDIT_MODE_DROPDOWN.innerHTML = "";
        this.COPY_MODE_DROPDOWN.innerHTML = "";
        for (let mode of this.modes) {
          let prettyMode = mode.charAt(0).toUpperCase();
          prettyMode += mode.slice(1);

          let choice = document.createElement("option");
          choice.value = mode;
          choice.innerText = prettyMode;
          this.CUR_MODE_DROPDOWN.appendChild(choice);
          this.EDIT_MODE_DROPDOWN.appendChild(choice.cloneNode(true) as HTMLElement);
          this.COPY_MODE_DROPDOWN.appendChild(choice.cloneNode(true) as HTMLElement);
        }
      }
    }

    let mode = getOrDefault(window.log, "NT:/OxConfig/CurrentMode", LoggableType.String, Infinity, "");

    if (mode != "" && this.mode != mode) {
      this.CUR_MODE_DROPDOWN.value = mode;
      this.mode = mode;
    }
  }
}

interface AxisConfig {
  min: number;
  max: number;
  step: number;

  /** The multipler used for the unit, if applicable. Does not affect the
   * actual size of the other values, but it can be used for labeling. */
  unit: number;
}
