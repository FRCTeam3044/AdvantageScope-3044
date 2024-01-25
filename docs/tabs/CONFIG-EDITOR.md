# 🛠️ Config Editor

_[< Return to homepage](/docs/INDEX.md)_

The config editor is designed to allow for easy viewing and editing of values used in the robot. It is intended for use with [OxConfig](https://github.com/FRCTeam3044/OxConfig), and will automatically update its json files and controllers in real time.

---

## Deploy Directory

When using the tuner, you should have a deploy directory set (unless you are only working in simulation). When you edit values, they are sent directly to the robot, where they are stored directly on the rio. However, on code rebuild, this config will be overwritten by the old values in the deploy folder. To prevent this, the tuner will write out the config file directly to the selected deploy folder.

This will only happen when either the Tuner or Config Editor tab is focused. If changes are made from another client on a different computer, and neither of these tabs are focused, the config will not be updated until the tab is focused.

To select the deploy folder, select File > Select Deploy Directory.

---

## General Usage

After you are connected to a robot, real or sim, running the OxConfig framework NT interface, the list of modes and table of values will be automatically populated.

At the top of the page, is a search bar and a mode dropdown. The mode dropdown shows the mode the robot is currently in and allows you to change it, which will change the values the robot uses (**including for controllers from the tuner, the config editor and tuner modes are one and the same**) to the values stored for that mode. The search bar will allow you to narrow down the currently displayed parameters for easy editing.

You will see a large table with Columns for the Parameter name, Comment, and values for all the different modes. Everything except the parameter name is editable and will be updated automatically in the json and immediatley in the robot code when you change it.

> Note: Values will not be sent to OxConfig until you press enter or click out of the table.

![Config Editor Demo](/docs/resources/config-editor/config-editor-1.gif)
