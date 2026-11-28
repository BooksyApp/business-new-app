/** Owner-app fixes of the 2026-11-28 E2E pass (visit move, time-off range, price range, small copy). AZ is the native source. */
export const v5En = {
  n5: {
    visitMove: 'All services of the visit will be moved together', visitTotal: 'total {{n}} min',
    tFrom: 'First day', tTo: 'Last day', tDays: '{{n}} days', tSaving: 'Saving {{a}} of {{b}}...', tPartial: 'Saved {{a}} of {{b}} days. The rest failed: {{e}}',
    priceMin: 'Minimum', priceMax: 'Maximum', priceMaxBad: 'Maximum cannot be below the minimum.',
    prevMonth: 'Previous month', nextMonth: 'Next month', nextWeek: 'Next week', prevWeek: 'Previous week',
    emptyDay: 'No bookings on this date', freeOther: 'Free on this date', dayFreeOther: 'Free on this date. Tap to add a booking.',
  },
};
export const v5Az: typeof v5En = {
  n5: {
    visitMove: 'Ziyarətin bütün xidmətləri birlikdə köçürüləcək', visitTotal: 'cəmi {{n}} dəq',
    tFrom: 'İlk gün', tTo: 'Son gün', tDays: '{{n}} gün', tSaving: '{{a}} / {{b}} saxlanılır...', tPartial: '{{a}} / {{b}} gün saxlanıldı. Qalanı alınmadı: {{e}}',
    priceMin: 'Minimum', priceMax: 'Maksimum', priceMaxBad: 'Maksimum minimumdan az ola bilməz.',
    prevMonth: 'Əvvəlki ay', nextMonth: 'Növbəti ay', nextWeek: 'Növbəti həftə', prevWeek: 'Əvvəlki həftə',
    emptyDay: 'Bu tarixdə rezerv yoxdur', freeOther: 'Bu tarixdə boşdur', dayFreeOther: 'Bu tarixdə boşdur. Toxunun və rezerv əlavə edin.',
  },
};
export const v5Ru: typeof v5En = {
  n5: {
    visitMove: 'Все услуги визита будут перенесены вместе', visitTotal: 'всего {{n}} мин',
    tFrom: 'Первый день', tTo: 'Последний день', tDays: '{{n}} дн.', tSaving: 'Сохранение {{a}} из {{b}}...', tPartial: 'Сохранено {{a}} из {{b}} дней. Остальные не удались: {{e}}',
    priceMin: 'Минимум', priceMax: 'Максимум', priceMaxBad: 'Максимум не может быть ниже минимума.',
    prevMonth: 'Предыдущий месяц', nextMonth: 'Следующий месяц', nextWeek: 'Следующая неделя', prevWeek: 'Предыдущая неделя',
    emptyDay: 'На эту дату записей нет', freeOther: 'Свободно на эту дату', dayFreeOther: 'Свободно на эту дату. Нажмите, чтобы добавить запись.',
  },
};
