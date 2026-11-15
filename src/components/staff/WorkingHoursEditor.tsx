import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  WEEK_DAYS,
  type DayKey,
  type DaySchedule,
  type WeekSchedule,
} from "./workingHours";
import { t } from "@/i18n";

export function WorkingHoursEditor({
  value,
  onChange,
}: {
  value: WeekSchedule;
  onChange: (next: WeekSchedule) => void;
}) {
  const setDay = (key: DayKey, patch: Partial<DaySchedule>) =>
    onChange({ ...value, [key]: { ...value[key], ...patch } });

  return (
    <div className="space-y-2">
      {WEEK_DAYS.map((d) => {
        const day = value[d.key];
        return (
          <div key={d.key} className="flex items-center gap-3">
            <Switch
              checked={day.enabled}
              onCheckedChange={(checked) => setDay(d.key, { enabled: checked })}
              aria-label={`${day.enabled ? t("staff.disable") : t("staff.enable")} ${d.label}`}
            />
            <span className="w-24 text-sm text-gray-700">{d.label}</span>
            {day.enabled ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={day.start}
                  onChange={(e) => setDay(d.key, { start: e.target.value })}
                  className="w-32"
                  aria-label={t("staff.startTime", { label: d.label })}
                />
                <span className="text-gray-400">–</span>
                <Input
                  type="time"
                  value={day.end}
                  onChange={(e) => setDay(d.key, { end: e.target.value })}
                  className="w-32"
                  aria-label={t("staff.endTime", { label: d.label })}
                />
              </div>
            ) : (
              <span className="text-sm text-gray-400">{t("common.closed")}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
