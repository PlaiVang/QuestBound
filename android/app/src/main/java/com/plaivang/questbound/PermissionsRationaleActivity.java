package com.plaivang.questbound;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;

public class PermissionsRationaleActivity extends Activity {
    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        TextView text = new TextView(this);
        text.setPadding(32, 64, 32, 32);
        text.setTextSize(18);
        text.setText("QuestBound Health Connect access\n\n"
            + "With your permission, QuestBound reads Samsung Health running sessions, distance and heart-rate readings from the last 30 days when you tap Import.\n\n"
            + "Imported summaries are stored privately on this device and used for your run log, analytics and game progression. No health records are written back or sent to our authentication provider. Route locations are not requested.\n\n"
            + "You can revoke these permissions in Health Connect, delete imported runs in QuestBound, or export a backup in Settings. Exported files contain your health data; share them only with people you trust.\n\n"
            + "Signing in does not upload or back up your runs. Uninstalling or clearing app data removes local records.");
        setContentView(text);
    }
}
