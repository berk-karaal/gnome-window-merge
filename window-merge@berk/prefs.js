import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class WindowMergePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: 'Shortcuts',
            description: 'Accelerator syntax, e.g. <Super>m or <Super><Shift>m',
        });
        page.add(group);
        group.add(this._shortcutRow(settings, 'merge-toggle', 'Merge / ungroup'));
        group.add(this._shortcutRow(settings, 'detach', 'Detach focused tab'));
        window.add(page);
    }

    _shortcutRow(settings, key, title) {
        const row = new Adw.EntryRow({title, text: settings.get_strv(key)[0] ?? ''});
        row.show_apply_button = true;
        row.connect('apply', () => {
            const [ok] = Gtk.accelerator_parse(row.text);
            if (ok)
                settings.set_strv(key, [row.text]);
            else
                row.text = settings.get_strv(key)[0] ?? '';
        });
        return row;
    }
}
