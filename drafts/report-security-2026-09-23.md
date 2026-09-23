# Security pilot — домен 9 RHCSA (12 черновиков)

**Дата:** 2026-09-23 · **Пайплайн:** 4.5 · **Тема:** `security` (`src/data/topics.ts:58`, статус `planned`)
**Вход:** банк 54 вопроса · **Выход:** `drafts/pending-security-2026-09-23.json`, без изменений банка.

## 1. Окружение (WSL Rocky 9.8)

| Проверка | Значение |
|---|---|
| Релиз | Rocky Linux release 9.8 (Blue Onyx) |
| SELinux | **Disabled** — эмпирика по SELinux невозможна, только man и `--help` |
| firewalld | active, `firewalld-1.3.4-20.el9_8.noarch`; uid=1000 **без авторизации**: `firewall-cmd --get-zones` → `NotAuthorizedException` |
| Отсутствует | `openssh-server` (нет ни `sshd`, ни man `sshd_config`), `auditd`/`auditctl`, `aide` |
| Доступно и покрыто man | getenforce, sestatus, semanage(-fcontext/-boolean), chcon, restorecon, getsebool, setsebool, firewall-cmd, firewalld.zone, sudo, sudoers, visudo, chage, shadow, pwquality.conf, login.defs, pam_faillock, capabilities, getcap, setcap, gpg |
| man locale | `C.UTF-8` (в системе есть `C` и `C.utf8`) |

**Следствие:** подтемы про SSH-демон (`PermitRootLogin`, `PasswordAuthentication`) и про `auditd` **исключены из пилота** — их невозможно проверить верифицируемым способом в этом окружении. Все 12 вопросов построены на темах, для которых man-страница существует и прочитана.

## 2. Что проверялось (L1–L8)

- **L1 Schema:** 4 опции, ровно 1 `correct`, уникальные `sec_001..sec_012`, `topic="security"`, `objective_domain="9"`, непустые question/explanation, `reference` в формате `man <cmd>` — **pass 12/12**.
- **L2 Deterministic QC:** bigram Jaccard между опциями, length ratio, плейсхолдеры, абсолютные термины — **0 отбраковок**. Найден и устранён 1 настоящий абсолютный термин: в `sec_008` вопрос содержал «все команды» → «произвольные команды». Срабатывания на `ALL` в `sec_008` — это ключевое слово sudoers, не абсолютный термин (зафиксировано отдельно, чтобы не потерять при следующем прогоне).
- **L3 Blueprint:** `objective_domain="9"` у всех — **pass 12/12**.
- **L4 Man verification:** сверка каждого вопроса с man Rocky 9.8 через `LC_ALL=C man <cmd> | col -b`. Ключевые подтверждения: `getenforce` печатает enforcing/permissive/disabled; `chcon -t/--type`; `semanage-fcontext` прямо предписывает `restorecon` после настройки; `setsebool [-PNV]`; `firewall-cmd --permanent` — «not effective immediately, only after service restart/reload or system reboot», `--reload` — «all runtime only changes … are lost»; `sudoers` NOPASSWD/PASSWD и четыре вида алиасов; `visudo` проверяет синтаксис перед установкой; `chage -M/--maxdays`; `pwquality.conf minlen` (не ниже 6, по умолчанию 8). **При N/A SELinux и NotAuthorized firewalld использовались только man-страницы и содержимое `/usr/lib/firewalld/zones/` — это отмечено как ограничение.**
- **L5 Duplicate detection:** Jaccard против банка и против черновиков; cosine против банка и черновиков. Порог reject — Jaccard > 0.9 и cosine > 0.85. Фактические максимумы: **Jaccard ≤ 0.1071, cosine ≤ 0.6907** — отбраковок нет, зона warn (0.80–0.85) не достигнута ни одним вопросом.
- **L5c Intra-batch:** 66 пар, **max cosine = 0.7367**, min = 0.1238; пар ≥ 0.80 — **0**, пар > 0.85 — **0**; пар с Jaccard > 0.5 — **0**.
- **L6 Coherence:** стем каждого вопроса допускает одно прочтение (назван конкретный объект и один целевой результат) — расхождений нет, **0 отбраковок**.
- **L7 Adversarial review:** режим `single_agent` (делегирование в этой сессии не запрашивалось). Роли factual / examiner / skeptic отражены в `_l7_verdict.critics_note` каждого вопроса, там же перечислены проверяемые заявки. Применено правило «критик вернул проверяемый risk → минимум `pass_with_flag`»: **1 pass + 11 pass_with_flag**.
- **L8 Checklist 4/4:** один концепт на вопрос; дистракторы правдоподобны (несуществующие ключи, обратные по смыслу опции, подмена runtime/permanent); абсолютных терминов нет; explanation разбирает **все четыре** опции — **4/4 у всех 12**.

## 3. Итоговые счётчики

| Метрика | Значение |
|---|---|
| total_generated | 12 |
| **total_passed** | **1** (`sec_002`) |
| **total_pass_with_flag** | **11** |
| total_reserve | 0 |
| total_rejected | 0 |
| recalibrated_to_pass | 0 (ШАГ 9 не запускался: reserve и rejected пусты) |
| **soft_MAC_flag** | **false** — условие «12/12 pass без критики» не выполнено |

## 4. Таблица результатов

| id | подтема | L1 | L2 | L3 | L4 | L6 | L8 | jac max | cos max | verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| sec_001 | SELinux: режимы и getenforce | pass | pass | pass | pass | pass | 4/4 | 0.0000 | 0.6093 | pass_with_flag |
| sec_002 | SELinux: контексты (chcon) | pass | pass | pass | pass | pass | 4/4 | 0.1071 | 0.6473 | **pass** |
| sec_003 | SELinux: semanage fcontext | pass | pass | pass | pass | pass | 4/4 | 0.0000 | 0.6238 | pass_with_flag |
| sec_004 | SELinux: булевы параметры | pass | pass | pass | pass | pass | 4/4 | 0.0000 | 0.6482 | pass_with_flag |
| sec_005 | firewalld: зоны | pass | pass | pass | pass | pass | 4/4 | 0.0000 | 0.5863 | pass_with_flag |
| sec_006 | firewalld: runtime vs permanent | pass | pass | pass | pass | pass | 4/4 | 0.0000 | 0.4598 | pass_with_flag |
| sec_007 | firewalld: службы и порты | pass | pass | pass | pass | pass | 4/4 | 0.0000 | 0.3493 | pass_with_flag |
| sec_008 | sudo: синтаксис sudoers | pass | pass | pass | pass | pass | 4/4 | 0.0000 | 0.6338 | pass_with_flag |
| sec_009 | sudo: Cmnd_Alias / User_Alias | pass | pass | pass | pass | pass | 4/4 | 0.0000 | 0.6815 | pass_with_flag |
| sec_010 | sudo: visudo | pass | pass | pass | pass | pass | 4/4 | 0.0769 | 0.6520 | pass_with_flag |
| sec_011 | chage: срок действия пароля | pass | pass | pass | pass | pass | 4/4 | 0.0000 | 0.6907 | pass_with_flag |
| sec_012 | pwquality.conf: minlen | pass | pass | pass | pass | pass | 4/4 | 0.0000 | 0.5647 | pass_with_flag |

## 5. Отбраковки и резерв

**Пусто.** `rejected: []`, `reserve: []`. Ни один вопрос не отклонён ни на L1, ни на L2, ни на L4, ни на L5, ни на L6, ни на L8 — поэтому ШАГ 9 (self-refinement) не запускался и счётчик `recalibrated_to_pass` равен 0.

## 6. Ограничения и оговорки

1. **SELinux = Disabled.** Все утверждения о SELinux опираются на man-страницы Rocky 9.8 и не проверены эмпирически. В WSL изменение режима не выполнялось (и запрещено заданием).
2. **firewalld без авторизации.** uid=1000 получает `NotAuthorizedException`, поэтому `--add-service`, `--reload`, `--list-all` не прогонялись. Факты взяты из `man firewall-cmd` (дословные формулировки про `--permanent` и `--reload`) и из набора зон `/usr/lib/firewalld/zones/` (trusted.xml, drop.xml, block.xml, public.xml и др.).
3. **Исключённые темы.** SSH-демон и auditd не вошли в пилот из-за отсутствия пакетов и man-страниц; это не отбраковка, а граница проверяемости.
4. **Class inversion.** Семантический фильтр `tools/cosine.cjs` на русском тексте не разделяет перефразы и фон (`tools/cosine-calibration.json#cosine_limitation`). Отсутствие отбраковок по cosine **не доказывает** отсутствие дубликатов: основной защитой остаётся Jaccard 0.9, который дал максимум 0.1071.
5. **Режим L7.** Гетерогенная дискуссия субагентов не запускалась, поэтому штраф за единогласие и флаг `soft_MAC` считались по формальному условию 12/12 pass без критики.

## 7. Что дальше

Все 12 вопросов готовы к merge в банк отдельной задачей (сейчас банк 54, тема `security` в `topics.ts` имеет статус `planned` — переключение статуса в этот пилот не входило). Перед merge стоит решить, переносить ли в банк `_l5` и `_l7_verdict` из черновика: банк использует компактный `_meta` + `validation`, поэтому при переносе эти поля, вероятно, будут свёрнуты.
