/** Strings of the full-API pass (waitlist, service/staff editors, till, reviews, reports, settings, looks). */
export const moreEn = {
  wl: { add: 'Add to waitlist', title: 'Waitlist', name: 'Client name', date: 'Preferred date (YYYY-MM-DD)', time: 'Preferred time (HH:MM, optional)', service: 'Service', remove: 'Remove', book: 'Book now', removed: 'Removed from the list', needName: 'Enter a name and pick a service.', badDate: 'Date must look like 2026-12-31.' },
  sx: {
    add: 'Add service', newTitle: 'New service', editTitle: 'Edit service', name: 'Name', description: 'Description', category: 'Category', noCategory: 'No category',
    tabMain: 'Main', tabPrice: 'Price', tabStaff: 'Specialists', tabOnline: 'Online booking', tabSettings: 'Settings',
    priceType: 'Price type', fixed: 'Fixed', from: 'From', range: 'Range', deposit: 'Deposit % (0 = none, 100 = full prepay)', tax: 'Tax %',
    pickStaff: 'Who performs this service', visible: 'Bookable online', visibleHint: 'Clients can find and book it in the booqi app.', padBefore: 'Buffer before (min)', padAfter: 'Buffer after (min)', interval: 'Step between start times (min)',
    parallel: 'Clients at once (0 = no limit)', mobile: 'Mobile service (at the client)', clientMessage: 'Message to the client after booking', archive: 'Archive', archived: 'Archived', restore: 'Restore', showArchived: 'Archived services',
    archiveConfirm: 'Archive this service? Existing bookings stay.', needName: 'Enter a name, price and duration.', categories: 'Categories', newCategory: 'New category', hide: 'Hide', show: 'Show', delCategory: 'Delete category', packages: 'Packages', noPackages: 'No packages yet', sessions: '{{n}} sessions',
  },
  tm: {
    add: 'Add specialist', newTitle: 'New specialist', editTitle: 'Edit specialist', name: 'Name', position: 'Position', services: 'Services', schedule: 'Weekly schedule', closed: 'Day off',
    invite: 'Send invitation', invited: 'Invitation sent', timeOff: 'Time off', noTimeOff: 'No time off planned', addTimeOff: 'Add time off', role: 'Role', needName: 'Enter a name.', deactivate: 'Deactivate', activate: 'Activate',
    days: { MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun' },
  },
  sl: {
    add: 'New sale', title: 'New sale', client: 'Client (optional)', master: 'Specialist', items: 'Items', pickService: 'Add a service', custom: 'Custom item', customName: 'Item name', price: 'Price', qty: 'Qty', discount: 'Discount', tip: 'Tip', method: 'Payment method', giftCode: 'Gift card code',
    total: 'Total', charge: 'Charge', done: 'Sale saved', needItem: 'Add at least one item.', needGift: 'Enter the gift card code.', refund: 'Refund', refundAmount: 'Refund amount', refundReason: 'Reason (optional)', refunded: 'Refund recorded', refundMax: 'Up to {{n}}', receipt: 'Receipt', tips: 'Tips today',
  },
  rv: { title: 'Reviews', average: 'Average', count: '{{n}} reviews', empty: 'No reviews yet', emptyBody: 'Reviews from clients appear here.', reply: 'Reply', yourReply: 'Your reply', send: 'Publish reply', report: 'Open a case', reportBody: 'A salon cannot edit, hide or delete a review. Tell the booqi team why it is wrong and they will check it.', reason: 'Reason', reasons: { FAKE: 'Fake or not a client', ABUSIVE: 'Abusive language', OTHER: 'Other' }, reportSent: 'Case opened. The team will review it.', anonymous: 'Client' },
  rp: { title: 'Reports', today: 'Today', week: '7 days', month: '30 days', revenue: 'Revenue', bookings: 'Bookings', averageTicket: 'Average ticket', clients: 'Clients', newClients: 'New clients', returningClients: 'Returning', noShowRate: 'No-show rate', cancellationRate: 'Cancellations', utilization: 'Utilization', onlineShare: 'Online share', top: 'Top services', team: 'Team', sources: 'Booking sources', vsPrev: 'vs previous period', empty: 'No data for this period' },
  hr: { title: 'Working hours', save: 'Save hours', saved: 'Working hours saved', open: 'Open', closed: 'Closed', badTime: 'Use HH:MM, closing after opening.' },
  ns: { title: 'Notification options', emailConfirmation: 'Booking confirmation e-mail', emailReminder: 'Reminder e-mail', emailCancellation: 'Cancellation e-mail', emailReschedule: 'Reschedule e-mail', emailWaitlist: 'Waitlist e-mail', emailReviewRequest: 'Review request e-mail', salonAlerts: 'E-mail me about online bookings', smsEnabled: 'SMS reminders', pushEnabled: 'Push notifications', whatsappEnabled: 'WhatsApp reminders', saved: 'Saved', unavailable: 'Not available on this plan' },
  sub: { title: 'Subscription', plan: 'Plan', status: 'Status', until: 'Renews / ends', trial: 'Trial ends' },
  lk: { photos: 'Photos', stories: 'Stories', empty: 'Nothing here yet', views: '{{n}} views', delete: 'Delete', confirmDelete: 'Delete this item?', webHint: 'Upload photos and stories in the web panel; here you can review and remove them.', pending: 'Pending', approved: 'Approved', rejected: 'Rejected' },
  cx: { edit: 'Edit client', consents: 'Consent forms', noConsents: 'No signed forms', saved: 'Client saved' },
};

export const moreAz: typeof moreEn = {
  wl: { add: 'Gözləmə siyahısına əlavə et', title: 'Gözləmə siyahısı', name: 'Müştərinin adı', date: 'İstədiyi tarix (YYYY-AA-GG)', time: 'İstədiyi saat (SS:DD, məcburi deyil)', service: 'Xidmət', remove: 'Sil', book: 'İndi rezerv et', removed: 'Siyahıdan silindi', needName: 'Ad yazın və xidmət seçin.', badDate: 'Tarix 2026-12-31 kimi olmalıdır.' },
  sx: {
    add: 'Xidmət əlavə et', newTitle: 'Yeni xidmət', editTitle: 'Xidmətə düzəliş', name: 'Ad', description: 'Təsvir', category: 'Kateqoriya', noCategory: 'Kateqoriyasız',
    tabMain: 'Əsas', tabPrice: 'Qiymət', tabStaff: 'Mütəxəssislər', tabOnline: 'Onlayn rezerv', tabSettings: 'Ayarlar',
    priceType: 'Qiymət növü', fixed: 'Sabit', from: 'Başlayaraq', range: 'Aralıq', deposit: 'Depozit % (0 = yox, 100 = tam ödəniş)', tax: 'Vergi %',
    pickStaff: 'Bu xidməti kim göstərir', visible: 'Onlayn rezerv olunur', visibleHint: 'Müştərilər booqi tətbiqində tapıb rezerv edə bilər.', padBefore: 'Əvvəl fasilə (dəq)', padAfter: 'Sonra fasilə (dəq)', interval: 'Başlama vaxtları arası (dəq)',
    parallel: 'Eyni anda müştəri (0 = limitsiz)', mobile: 'Səyyar xidmət (müştərinin yanında)', clientMessage: 'Rezervdən sonra müştəriyə mesaj', archive: 'Arxivə at', archived: 'Arxivlənib', restore: 'Bərpa et', showArchived: 'Arxivlənmiş xidmətlər',
    archiveConfirm: 'Bu xidmət arxivə atılsın? Mövcud rezervlər qalır.', needName: 'Ad, qiymət və müddət yazın.', categories: 'Kateqoriyalar', newCategory: 'Yeni kateqoriya', hide: 'Gizlət', show: 'Göstər', delCategory: 'Kateqoriyanı sil', packages: 'Paketlər', noPackages: 'Hələ paket yoxdur', sessions: '{{n}} seans',
  },
  tm: {
    add: 'Mütəxəssis əlavə et', newTitle: 'Yeni mütəxəssis', editTitle: 'Mütəxəssisə düzəliş', name: 'Ad', position: 'Vəzifə', services: 'Xidmətlər', schedule: 'Həftəlik cədvəl', closed: 'İstirahət günü',
    invite: 'Dəvət göndər', invited: 'Dəvət göndərildi', timeOff: 'İstirahət / məzuniyyət', noTimeOff: 'Planlaşdırılmış istirahət yoxdur', addTimeOff: 'İstirahət əlavə et', role: 'Rol', needName: 'Ad yazın.', deactivate: 'Deaktiv et', activate: 'Aktiv et',
    days: { MONDAY: 'B.e.', TUESDAY: 'Ç.a.', WEDNESDAY: 'Çər.', THURSDAY: 'C.a.', FRIDAY: 'Cümə', SATURDAY: 'Şən.', SUNDAY: 'Baz.' },
  },
  sl: {
    add: 'Yeni satış', title: 'Yeni satış', client: 'Müştəri (məcburi deyil)', master: 'Mütəxəssis', items: 'Mallar', pickService: 'Xidmət əlavə et', custom: 'Xüsusi mövqe', customName: 'Mövqenin adı', price: 'Qiymət', qty: 'Say', discount: 'Endirim', tip: 'Çay pulu', method: 'Ödəniş üsulu', giftCode: 'Hədiyyə kartının kodu',
    total: 'Cəmi', charge: 'Ödənişi qəbul et', done: 'Satış yazıldı', needItem: 'Ən azı bir mövqe əlavə edin.', needGift: 'Hədiyyə kartının kodunu yazın.', refund: 'Geri qaytarma', refundAmount: 'Qaytarılan məbləğ', refundReason: 'Səbəb (məcburi deyil)', refunded: 'Geri qaytarma yazıldı', refundMax: '{{n}}-dək', receipt: 'Qəbz', tips: 'Bu gün çay pulu',
  },
  rv: { title: 'Rəylər', average: 'Orta', count: '{{n}} rəy', empty: 'Hələ rəy yoxdur', emptyBody: 'Müştəri rəyləri burada görünəcək.', reply: 'Cavab ver', yourReply: 'Sizin cavabınız', send: 'Cavabı dərc et', report: 'Hal aç', reportBody: 'Salon rəyi redaktə edə, gizlədə və ya silə bilməz. Rəyin nə üçün yanlış olduğunu booqi komandasına yazın, yoxlayacaq.', reason: 'Səbəb', reasons: { FAKE: 'Saxta və ya müştəri deyil', ABUSIVE: 'Təhqiramiz dil', OTHER: 'Digər' }, reportSent: 'Hal açıldı. Komanda yoxlayacaq.', anonymous: 'Müştəri' },
  rp: { title: 'Hesabatlar', today: 'Bu gün', week: '7 gün', month: '30 gün', revenue: 'Gəlir', bookings: 'Rezervlər', averageTicket: 'Orta çek', clients: 'Müştərilər', newClients: 'Yeni müştərilər', returningClients: 'Təkrar gələn', noShowRate: 'Gəlməyənlər', cancellationRate: 'Ləğvlər', utilization: 'Yüklənmə', onlineShare: 'Onlayn pay', top: 'Ən çox satılan xidmətlər', team: 'Komanda', sources: 'Rezerv mənbələri', vsPrev: 'əvvəlki dövrlə müqayisədə', empty: 'Bu dövr üçün məlumat yoxdur' },
  hr: { title: 'İş saatları', save: 'Saatları saxla', saved: 'İş saatları saxlanıldı', open: 'Açıq', closed: 'Bağlı', badTime: 'SS:DD yazın, bağlanış açılışdan sonra olmalıdır.' },
  ns: { title: 'Bildiriş seçimləri', emailConfirmation: 'Rezerv təsdiqi e-poçtu', emailReminder: 'Xatırlatma e-poçtu', emailCancellation: 'Ləğv e-poçtu', emailReschedule: 'Vaxt dəyişikliyi e-poçtu', emailWaitlist: 'Gözləmə siyahısı e-poçtu', emailReviewRequest: 'Rəy xahişi e-poçtu', salonAlerts: 'Onlayn rezervlər barədə mənə yaz', smsEnabled: 'SMS xatırlatmaları', pushEnabled: 'Push bildirişlər', whatsappEnabled: 'WhatsApp xatırlatmaları', saved: 'Saxlanıldı', unavailable: 'Bu planda mövcud deyil' },
  sub: { title: 'Abunəlik', plan: 'Plan', status: 'Status', until: 'Yenilənmə / bitmə', trial: 'Sınaq bitir' },
  lk: { photos: 'Şəkillər', stories: 'Hekayələr', empty: 'Hələ heç nə yoxdur', views: '{{n}} baxış', delete: 'Sil', confirmDelete: 'Bu silinsin?', webHint: 'Şəkil və hekayələri veb paneldən yükləyin; burada baxıb silə bilərsiniz.', pending: 'Gözləyir', approved: 'Təsdiqlənib', rejected: 'Rədd edilib' },
  cx: { edit: 'Müştəriyə düzəliş', consents: 'Razılıq formaları', noConsents: 'İmzalanmış forma yoxdur', saved: 'Müştəri saxlanıldı' },
};

export const moreRu: typeof moreEn = {
  wl: { add: 'Добавить в лист ожидания', title: 'Лист ожидания', name: 'Имя клиента', date: 'Желаемая дата (ГГГГ-ММ-ДД)', time: 'Желаемое время (ЧЧ:ММ, необязательно)', service: 'Услуга', remove: 'Убрать', book: 'Записать', removed: 'Убран из списка', needName: 'Введите имя и выберите услугу.', badDate: 'Дата должна выглядеть как 2026-12-31.' },
  sx: {
    add: 'Добавить услугу', newTitle: 'Новая услуга', editTitle: 'Изменить услугу', name: 'Название', description: 'Описание', category: 'Категория', noCategory: 'Без категории',
    tabMain: 'Основное', tabPrice: 'Цена', tabStaff: 'Мастера', tabOnline: 'Онлайн-запись', tabSettings: 'Настройки',
    priceType: 'Тип цены', fixed: 'Фиксированная', from: 'От', range: 'Диапазон', deposit: 'Депозит % (0 = нет, 100 = полная предоплата)', tax: 'Налог %',
    pickStaff: 'Кто выполняет услугу', visible: 'Доступна для онлайн-записи', visibleHint: 'Клиенты находят и записываются в приложении booqi.', padBefore: 'Перерыв до (мин)', padAfter: 'Перерыв после (мин)', interval: 'Шаг начала записи (мин)',
    parallel: 'Клиентов одновременно (0 = без лимита)', mobile: 'Выездная услуга (у клиента)', clientMessage: 'Сообщение клиенту после записи', archive: 'В архив', archived: 'В архиве', restore: 'Восстановить', showArchived: 'Архивные услуги',
    archiveConfirm: 'Отправить услугу в архив? Существующие записи останутся.', needName: 'Введите название, цену и длительность.', categories: 'Категории', newCategory: 'Новая категория', hide: 'Скрыть', show: 'Показать', delCategory: 'Удалить категорию', packages: 'Пакеты', noPackages: 'Пакетов пока нет', sessions: '{{n}} сеансов',
  },
  tm: {
    add: 'Добавить мастера', newTitle: 'Новый мастер', editTitle: 'Изменить мастера', name: 'Имя', position: 'Должность', services: 'Услуги', schedule: 'График на неделю', closed: 'Выходной',
    invite: 'Отправить приглашение', invited: 'Приглашение отправлено', timeOff: 'Отпуск / отгулы', noTimeOff: 'Отсутствий не запланировано', addTimeOff: 'Добавить отсутствие', role: 'Роль', needName: 'Введите имя.', deactivate: 'Отключить', activate: 'Включить',
    days: { MONDAY: 'Пн', TUESDAY: 'Вт', WEDNESDAY: 'Ср', THURSDAY: 'Чт', FRIDAY: 'Пт', SATURDAY: 'Сб', SUNDAY: 'Вс' },
  },
  sl: {
    add: 'Новая продажа', title: 'Новая продажа', client: 'Клиент (необязательно)', master: 'Мастер', items: 'Позиции', pickService: 'Добавить услугу', custom: 'Своя позиция', customName: 'Название позиции', price: 'Цена', qty: 'Кол-во', discount: 'Скидка', tip: 'Чаевые', method: 'Способ оплаты', giftCode: 'Код подарочной карты',
    total: 'Итого', charge: 'Принять оплату', done: 'Продажа сохранена', needItem: 'Добавьте хотя бы одну позицию.', needGift: 'Введите код подарочной карты.', refund: 'Возврат', refundAmount: 'Сумма возврата', refundReason: 'Причина (необязательно)', refunded: 'Возврат записан', refundMax: 'До {{n}}', receipt: 'Чек', tips: 'Чаевые за сегодня',
  },
  rv: { title: 'Отзывы', average: 'Средняя', count: 'Отзывов: {{n}}', empty: 'Отзывов пока нет', emptyBody: 'Отзывы клиентов появятся здесь.', reply: 'Ответить', yourReply: 'Ваш ответ', send: 'Опубликовать ответ', report: 'Открыть обращение', reportBody: 'Салон не может редактировать, скрывать или удалять отзыв. Напишите команде booqi, почему он неверен, и её специалисты проверят.', reason: 'Причина', reasons: { FAKE: 'Фейк или не клиент', ABUSIVE: 'Оскорбления', OTHER: 'Другое' }, reportSent: 'Обращение открыто. Команда проверит.', anonymous: 'Клиент' },
  rp: { title: 'Отчёты', today: 'Сегодня', week: '7 дней', month: '30 дней', revenue: 'Выручка', bookings: 'Записи', averageTicket: 'Средний чек', clients: 'Клиенты', newClients: 'Новые клиенты', returningClients: 'Повторные', noShowRate: 'Неявки', cancellationRate: 'Отмены', utilization: 'Загрузка', onlineShare: 'Доля онлайн', top: 'Топ услуг', team: 'Команда', sources: 'Источники записей', vsPrev: 'к прошлому периоду', empty: 'Нет данных за период' },
  hr: { title: 'Часы работы', save: 'Сохранить часы', saved: 'Часы работы сохранены', open: 'Открыто', closed: 'Закрыто', badTime: 'Формат ЧЧ:ММ, закрытие позже открытия.' },
  ns: { title: 'Настройки уведомлений', emailConfirmation: 'Письмо-подтверждение записи', emailReminder: 'Письмо-напоминание', emailCancellation: 'Письмо об отмене', emailReschedule: 'Письмо о переносе', emailWaitlist: 'Письмо листа ожидания', emailReviewRequest: 'Письмо с просьбой об отзыве', salonAlerts: 'Писать мне об онлайн-записях', smsEnabled: 'SMS-напоминания', pushEnabled: 'Push-уведомления', whatsappEnabled: 'WhatsApp-напоминания', saved: 'Сохранено', unavailable: 'Недоступно на этом тарифе' },
  sub: { title: 'Подписка', plan: 'Тариф', status: 'Статус', until: 'Продление / окончание', trial: 'Пробный период до' },
  lk: { photos: 'Фото', stories: 'Истории', empty: 'Пока ничего нет', views: 'Просмотров: {{n}}', delete: 'Удалить', confirmDelete: 'Удалить это?', webHint: 'Фото и истории загружаются в веб-панели; здесь их можно просмотреть и удалить.', pending: 'На проверке', approved: 'Одобрено', rejected: 'Отклонено' },
  cx: { edit: 'Изменить клиента', consents: 'Формы согласия', noConsents: 'Подписанных форм нет', saved: 'Клиент сохранён' },
};
