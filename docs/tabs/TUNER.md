# 🎛 Tuner

_[< Return to homepage](/docs/INDEX.md)_

The tuner is designed to allow for easy viewing of PID Graphs (or really any graph) and easy, live editing of values. It is intended for use with [OxConfig](https://github.com/FRCTeam3044/OxConfig), and will automatically update its json files and controllers in real time.

---

## Deploy Directory

When using the tuner, you should have a deploy directory set (unless you are only working in simulation). When you edit values, they are sent directly to the robot, where they are stored directly on the rio. However, on code rebuild, this config will be overwritten by the old values in the deploy folder. To prevent this, the tuner will write out the config file directly to the selected deploy folder.

This will only happen when either the Tuner or Config Editor tab is focused. If changes are made from another client on a different computer, and neither of these tabs are focused, the config will not be updated until the tab is focused.

To select the deploy folder, select File > Select Deploy Directory.

---

## General Usage

After you are connected to a robot, real or sim, running the OxConfig framework NT interface, the list of modes and controllers will be automatically populated.

At the top of the page, there are two mode dropdowns. The first one shows the mode the robot is currently in and allows you to change it, which will change the values the robot uses for controllers (**and normal config, the config editor and tuner modes are one and the same**) to the values stored for that mode. The second dropdown represents the current mode of the controllers you are editing. Changing this will have no effect on the robot's active mode. It will allow you to edit the values for a different mode than the robot is in if you desire.

Under the mode dropdowns, you will find a dropdown for the currently selected controller. It will show all available controllers from the robot. You can select a controller to edit, and its current values will be shown in the table. These values are editable and will be sent to the robot to update in real-time.

> Note: Values will not be sent to OxConfig until you press enter or click out of the table.

![Tuner Demo](/docs/resources/tuner/tuner-1.gif)

## Mode copying

Sometimes, controllers should stay the same in multiple modes, or in all modes. There are two ways to do this.

### Copying from one mode

There is a button labeled "Copy From Selected Mode" with a dropdown to select a mode next to it. When you click the button, a confirmation prompt will appear. If you click confirm, all values for the currently selected controller for the mode selected in the dropdown next to the button will be copied to the currently selected edit mode, overwriting it's old values. This action is irreversable, so use with caution.

### Copying to all modes

There is a button labeled "Copy To All Modes". When you click the button, a confirmation prompt will appear. If you click confirm, all values for the currently selected controller for the currently selected edit mode will be copied to all other modes for the selected controller, overwriting their old values. This action is irreversable, so use with caution.

![Tuner Copying Demo](/docs/resources/tuner/tuner-2.gif)
