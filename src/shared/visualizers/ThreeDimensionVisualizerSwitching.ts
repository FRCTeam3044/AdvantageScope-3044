import ThreeDimensionVisualizer from "./ThreeDimensionVisualizer";
import Visualizer from "./Visualizer";

/** Wrapper around ThreeDimensionVisualizer to automatically switch rendering modes. */
export default class ThreeDimensionVisualizerSwitching implements Visualizer {
  private content: HTMLElement;
  private canvas: HTMLCanvasElement;
  private annotationsDiv: HTMLElement;
  private alert: HTMLElement;
  private visualizer: ThreeDimensionVisualizer | null = null;

  private lastMode: "cinematic" | "standard" | "low-power" | null = null;
  private lastClickToGo: boolean | null = null;
  private lastClickToGoKey: string | null = null;
  private lastCameraIndex: number | null = null;
  private lastFov: number | null = null;

  constructor(content: HTMLElement, canvas: HTMLCanvasElement, annotationsDiv: HTMLElement, alert: HTMLElement) {
    this.content = content;
    this.canvas = canvas;
    this.annotationsDiv = annotationsDiv;
    this.alert = alert;
    this.render(null);
  }

  saveState() {
    if (this.visualizer !== null) {
      return this.visualizer.saveState();
    }
    return null;
  }

  restoreState(state: any): void {
    if (this.visualizer !== null && state !== null) {
      this.visualizer.restoreState(state);
    }
  }

  /** Switches the selected camera. */
  set3DCamera(index: number) {
    this.visualizer?.set3DCamera(index);
  }

  /** Updates the orbit FOV. */
  setFov(fov: number) {
    this.visualizer?.setFov(fov);
  }

  render(command: any): number | null {
    // Get current mode
    let mode: "cinematic" | "standard" | "low-power" = "standard";
    let clickToGo: boolean = false;
    let clickToGoKey: string = "";
    if (window.preferences) {
      if (window.isBattery && window.preferences.threeDimensionModeBattery !== "") {
        mode = window.preferences.threeDimensionModeBattery;
      } else {
        mode = window.preferences.threeDimensionModeAc;
      }
      clickToGo = window.preferences.clickToGo === "3d" || window.preferences.clickToGo === "both";
      clickToGoKey = window.preferences.clickToGoKey;
    }

    // Recreate visualizer if necessary
    if (mode !== this.lastMode || clickToGo !== this.lastClickToGo || clickToGoKey !== this.lastClickToGoKey) {
      this.lastMode = mode;
      this.lastClickToGo = clickToGo;
      this.lastClickToGoKey = clickToGoKey;
      let cameraPositions: [THREE.Vector3, THREE.Vector3] | null = null;
      let state: any = null;
      if (this.visualizer !== null) {
        state = this.visualizer.saveState();
        this.visualizer.stop();
      }
      {
        let newCanvas = document.createElement("canvas");
        this.canvas.classList.forEach((className) => {
          newCanvas.classList.add(className);
        });
        newCanvas.id = this.canvas.id;
        this.canvas.replaceWith(newCanvas);
        this.canvas = newCanvas;
      }
      {
        let newDiv = document.createElement("div");
        this.annotationsDiv.classList.forEach((className) => {
          newDiv.classList.add(className);
        });
        newDiv.id = this.annotationsDiv.id;
        this.annotationsDiv.replaceWith(newDiv);
        this.annotationsDiv = newDiv;
      }
      this.visualizer = new ThreeDimensionVisualizer(
        mode,
        this.content,
        this.canvas,
        this.annotationsDiv,
        this.alert,
        clickToGo,
        clickToGoKey
      );
      if (state !== null) {
        this.visualizer.restoreState(state);
      }
    }

    // Send command
    if (this.visualizer === null || command === null) {
      return null;
    } else {
      return this.visualizer.render(command);
    }
  }
}
