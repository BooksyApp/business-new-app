/** Strings added with the native feature pass (clients, week view, blocks, repeat, services, team, sales, messages, settings). AZ is the default locale. */
export const extraEn = {
  net: { offline: 'No connection. Showing saved data.' },
  cl: {
    segAll: 'All', segNew: 'New', segRegular: 'Regular', segLapsed: '60+ days away', segNever: 'No visits',
    statClients: 'Clients', statReturning: 'Returning', statAvg: 'Avg. spend',
    add: 'Add client', addTitle: 'New client', addFailed: 'Could not add the client', email: 'E-mail',
    needContact: 'Add a phone number or an e-mail.',
    consentMarketing: 'Agrees to marketing e-mails', consentSms: 'Agrees to SMS notifications',
    noResults: 'Nothing found', noResultsBody: 'Try another name or phone number, or show everyone.', clearFilters: 'Clear search and filters',
    emptyBody: 'Everyone who books appears here. You can also add a client yourself.',
    unnamed: 'Unnamed client', noContact: 'No contact details',
    tagNew: 'New', tagRegular: 'Regular', tagLapsed: 'Away', visitsN: '{{n}} visits', noShowsN: '{{n}} no-shows',
    newBooking: 'New appointment', avgCheck: 'Average check', nextVisit: 'Next visit', favService: 'Favourite service', favMaster: 'Favourite master',
  },
  block: {
    title: 'Blocked time', new: 'Block time', fullDay: 'Whole day', from: 'From', to: 'To', reason: 'Reason (only you see it)',
    badRange: 'The end must be after the start.', save: 'Block', remove: 'Remove block',
  },
  svc: { edit: 'Edit price and duration', duration: 'Duration', invalid: 'Enter a valid price and duration.' },
  team: { empty: 'No team members yet', inactive: 'Inactive', email: 'Send e-mail' },
  sales: {
    prev: 'Previous day', next: 'Next day', total: '{{n}} sales', empty: 'No sales this day', emptyBody: 'Sales taken at the till appear here.', walkIn: 'Walk-in',
    m: { CASH: 'Cash', CARD_TERMINAL: 'Card', CHECK: 'Check', SPLIT: 'Split', MEMBERSHIP: 'Membership', GIFT_CARD: 'Gift card', PACKAGE: 'Package' },
  },
  msg: { empty: 'No messages yet', emptyBody: 'Chats started by clients in the booqi app appear here.', threadEmpty: 'No messages in this chat', reply: 'Write a reply', send: 'Send', unread: '{{n}} unread' },
  set: { salon: 'Salon', name: 'Name', address: 'Address', currency: 'Currency', webHint: 'Salon details are edited in the web panel.', notifications: 'Notifications', account: 'Account', user: 'Name', role: 'Role', theme: 'Appearance', themeSystem: 'System', themeLight: 'Light', themeDark: 'Dark' },
};

export const extraAz: typeof extraEn = {
  net: { offline: 'Bağlantı yoxdur. Saxlanmış məlumat göstərilir.' },
  cl: {
    segAll: 'Hamısı', segNew: 'Yeni', segRegular: 'Daimi', segLapsed: '60+ gündür gəlməyib', segNever: 'Gəlişi yoxdur',
    statClients: 'Müştərilər', statReturning: 'Qayıdanlar', statAvg: 'Orta xərc',
    add: 'Müştəri əlavə et', addTitle: 'Yeni müştəri', addFailed: 'Müştərini əlavə etmək alınmadı', email: 'E-poçt',
    needContact: 'Telefon nömrəsi və ya e-poçt yazın.',
    consentMarketing: 'Reklam məktublarına razıdır', consentSms: 'SMS bildirişlərinə razıdır',
    noResults: 'Heç nə tapılmadı', noResultsBody: 'Başqa ad və ya telefon yazın, ya da hamını göstərin.', clearFilters: 'Axtarışı və filtrləri təmizlə',
    emptyBody: 'Yazılan hər kəs avtomatik burada görünür. Müştərini özünüz də əlavə edə bilərsiniz.',
    unnamed: 'Adsız müştəri', noContact: 'Əlaqə məlumatı yoxdur',
    tagNew: 'Yeni', tagRegular: 'Daimi', tagLapsed: 'Uzaqdır', visitsN: '{{n}} gəliş', noShowsN: '{{n}} gəlmədi',
    newBooking: 'Yeni rezerv', avgCheck: 'Orta çek', nextVisit: 'Növbəti gəliş', favService: 'Sevimli xidmət', favMaster: 'Sevimli usta',
  },
  block: {
    title: 'Bloklanmış vaxt', new: 'Vaxtı blokla', fullDay: 'Bütün gün', from: 'Başlanğıc', to: 'Son', reason: 'Səbəb (yalnız siz görürsünüz)',
    badRange: 'Son vaxt başlanğıcdan sonra olmalıdır.', save: 'Blokla', remove: 'Bloku sil',
  },
  svc: { edit: 'Qiymət və müddəti dəyiş', duration: 'Müddət', invalid: 'Düzgün qiymət və müddət yazın.' },
  team: { empty: 'Hələ komanda üzvü yoxdur', inactive: 'Aktiv deyil', email: 'E-poçt göndər' },
  sales: {
    prev: 'Əvvəlki gün', next: 'Növbəti gün', total: '{{n}} satış', empty: 'Bu gün satış yoxdur', emptyBody: 'Kassada edilən satışlar burada görünür.', walkIn: 'Yazılmadan gələn',
    m: { CASH: 'Nağd', CARD_TERMINAL: 'Kart', CHECK: 'Çek', SPLIT: 'Bölünmüş', MEMBERSHIP: 'Üzvlük', GIFT_CARD: 'Hədiyyə kartı', PACKAGE: 'Paket' },
  },
  msg: { empty: 'Hələ mesaj yoxdur', emptyBody: 'Müştərilərin booqi tətbiqində başlatdığı söhbətlər burada görünür.', threadEmpty: 'Bu söhbətdə mesaj yoxdur', reply: 'Cavab yazın', send: 'Göndər', unread: '{{n}} oxunmamış' },
  set: { salon: 'Salon', name: 'Ad', address: 'Ünvan', currency: 'Valyuta', webHint: 'Salon məlumatları veb paneldə dəyişdirilir.', notifications: 'Bildirişlər', account: 'Hesab', user: 'Ad', role: 'Rol', theme: 'Görünüş', themeSystem: 'Sistem', themeLight: 'Açıq', themeDark: 'Tünd' },
};

export const extraRu: typeof extraEn = {
  net: { offline: 'Нет соединения. Показаны сохранённые данные.' },
  cl: {
    segAll: 'Все', segNew: 'Новые', segRegular: 'Постоянные', segLapsed: 'Не были 60+ дней', segNever: 'Без визитов',
    statClients: 'Клиенты', statReturning: 'Вернулись', statAvg: 'Средний чек',
    add: 'Добавить клиента', addTitle: 'Новый клиент', addFailed: 'Не удалось добавить клиента', email: 'E-mail',
    needContact: 'Укажите телефон или e-mail.',
    consentMarketing: 'Согласен на рассылку', consentSms: 'Согласен на SMS-уведомления',
    noResults: 'Ничего не найдено', noResultsBody: 'Попробуйте другое имя или номер, либо покажите всех.', clearFilters: 'Сбросить поиск и фильтры',
    emptyBody: 'Все, кто записался, появятся здесь. Клиента можно добавить и вручную.',
    unnamed: 'Клиент без имени', noContact: 'Нет контактных данных',
    tagNew: 'Новый', tagRegular: 'Постоянный', tagLapsed: 'Давно не был', visitsN: 'Визитов: {{n}}', noShowsN: 'Неявок: {{n}}',
    newBooking: 'Новая запись', avgCheck: 'Средний чек', nextVisit: 'Следующий визит', favService: 'Любимая услуга', favMaster: 'Любимый мастер',
  },
  block: {
    title: 'Заблокированное время', new: 'Заблокировать время', fullDay: 'Весь день', from: 'С', to: 'До', reason: 'Причина (видите только вы)',
    badRange: 'Конец должен быть позже начала.', save: 'Заблокировать', remove: 'Снять блок',
  },
  svc: { edit: 'Изменить цену и длительность', duration: 'Длительность', invalid: 'Введите корректную цену и длительность.' },
  team: { empty: 'Пока нет сотрудников', inactive: 'Не активен', email: 'Написать на e-mail' },
  sales: {
    prev: 'Предыдущий день', next: 'Следующий день', total: 'Продаж: {{n}}', empty: 'В этот день продаж нет', emptyBody: 'Продажи с кассы появятся здесь.', walkIn: 'Без записи',
    m: { CASH: 'Наличные', CARD_TERMINAL: 'Карта', CHECK: 'Чек', SPLIT: 'Раздельно', MEMBERSHIP: 'Абонемент', GIFT_CARD: 'Подарочная карта', PACKAGE: 'Пакет' },
  },
  msg: { empty: 'Сообщений пока нет', emptyBody: 'Чаты, начатые клиентами в приложении booqi, появятся здесь.', threadEmpty: 'В этом чате нет сообщений', reply: 'Напишите ответ', send: 'Отправить', unread: 'Непрочитанных: {{n}}' },
  set: { salon: 'Салон', name: 'Название', address: 'Адрес', currency: 'Валюта', webHint: 'Данные салона редактируются в веб-панели.', notifications: 'Уведомления', account: 'Аккаунт', user: 'Имя', role: 'Роль', theme: 'Оформление', themeSystem: 'Системная', themeLight: 'Светлая', themeDark: 'Тёмная' },
};
