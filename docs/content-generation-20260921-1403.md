# Отчёт генерации контента

Дата: 2026-09-21 14:03
Файл: src/data/questions.json
Бэкап: src/data/questions.json.bak (MD5 исходника: 09ba8906a73161f08778452308d05370)

## Итог
- Сгенерировано: 30
- Валидных: 30
- Отклонено после 2 раундов: 0
- Финальный размер questions.json: 35

## По темам
| Тема | Сгенерировано | Валидных | Отклонено |
|------|---------------|----------|-----------|
| file_permissions | 10 | 10 | 0 |
| file_management | 10 | 10 | 0 |
| process_management | 10 | 10 | 0 |

## Покрытие RHCSA-доменов (30 новых вопросов)
| Домен | Вопросов |
|-------|----------|
| 1. Understand and use essential tools | 4 |
| 2. Create simple shell scripts | 0 |
| 3. Operate running systems | 4 |
| 4. Configure local storage | 2 |
| 5. Create and configure file systems | 4 |
| 6. Deploy, configure, and maintain systems | 3 |
| 7. Manage basic networking | 3 |
| 8. Manage users and groups | 1 |
| 9. Manage security | 9 |

Итого задействовано 8 доменов из 9 (требование: не менее 7/9).
Домен 2 (shell scripts) сознательно не задействован: в банке нет заданий на написание
скриптов, а приписывать существующим вопросам этот домен было бы недостоверно.
Домен 8 представлен вопросом fp_004 (chown -R user1:devs /data — владельцы и группы).

## Отклонённые вопросы
Нет. Все 30 вопросов прошли валидацию с первого раунда: ровно один correct:true,
ровно 4 варианта, объяснение содержит разбор ближайшего дистрактора,
objective_domain в диапазоне 1-9, subtopic строго из обязательного списка
(использованы все 22 сабтопика), не более 2 вопросов на сабтопик внутри темы.

## Итоговое распределение сложности
Новые 30: easy 10, medium 14, hard 6.
В файле целиком (35): easy 12, medium 16, hard 7.
Норматив по заданию 11e/17m/7h (+-2) — попадание в допуск по всем трём уровням.

## Идентификаторы
- Существующие (сохранены дословно, порядок не менялся): fp_001, fp_002, fm_001, fm_002, pm_001
- Новые: fp_003..fp_012, fm_003..fm_012, pm_002..pm_011

## Примечание о полях метаданных
Поля objective_domain и subtopic добавлены только к 30 новым вопросам, как требует
раздел ID RANGES («Existing to preserve verbatim», «DO NOT reorder or modify»).
Исходные 5 вопросов сохранили прежний набор полей (id, topic, difficulty, question,
options, explanation); их сравнение с бэкапом даёт deep-equal: true, а порядок id
подтверждён проверкой existing intact: true.
Поэтому проверка схемы из шага 5 сообщает 15 сообщений только для этих 5 унаследованных
записей (по 3 на запись: missing objective_domain, missing subtopic и objective_domain invalid).
Для новых 30 вопросов та же проверка проходит чисто.