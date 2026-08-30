// SPDX-License-Identifier: GPL-2.0-or-later
import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class WindowMergePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({title: 'Shortcuts'});
        page.add(group);
        group.add(new ShortcutRow(settings, 'merge-toggle', 'Merge / ungroup'));
        group.add(new ShortcutRow(settings, 'detach', 'Detach focused tab'));
        window.add(page);
    }
}

const ShortcutRow = GObject.registerClass(
class ShortcutRow extends Adw.ActionRow {
    constructor(settings, key, title) {
        super({title, activatable: true});
        this._settings = settings;
        this._key = key;
        this._label = new Gtk.ShortcutLabel({disabled_text: 'Disabled', valign: Gtk.Align.CENTER});
        this.add_suffix(this._label);
        this._refresh();
        this.connect('activated', () => this._record());
    }

    _refresh() {
        this._label.accelerator = this._settings.get_strv(this._key)[0] ?? '';
    }

    _record() {
        const dialog = new Adw.Dialog({
            title: this.title,
            content_width: 360,
        });
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 24, margin_bottom: 24, margin_start: 24, margin_end: 24,
        });
        box.append(new Adw.HeaderBar({show_start_title_buttons: false, show_end_title_buttons: false}));
        box.append(new Gtk.Label({label: 'Press the new shortcut', css_classes: ['title-2']}));
        box.append(new Gtk.Label({label: 'Backspace clears it, Esc cancels', css_classes: ['dim-label']}));
        dialog.set_child(box);

        const controller = new Gtk.EventControllerKey();
        controller.connect('key-pressed', (_c, keyval, keycode, state) => {
            const mask = state & Gtk.accelerator_get_default_mod_mask() & ~Gdk.ModifierType.LOCK_MASK;
            if (keyval === Gdk.KEY_Escape) {
                dialog.close();
                return Gdk.EVENT_STOP;
            }
            if (keyval === Gdk.KEY_BackSpace) {
                this._settings.set_strv(this._key, []);
                this._refresh();
                dialog.close();
                return Gdk.EVENT_STOP;
            }
            if (mask === 0 || !Gtk.accelerator_valid(keyval, mask))
                return Gdk.EVENT_STOP;
            const accel = Gtk.accelerator_name_with_keycode(null, keyval, keycode, mask);
            this._settings.set_strv(this._key, [accel]);
            this._refresh();
            dialog.close();
            return Gdk.EVENT_STOP;
        });
        dialog.add_controller(controller);
        dialog.present(this.get_root());
    }
});
