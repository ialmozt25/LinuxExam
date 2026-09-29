# Текущая работа

Обновлять при каждом коммите: HEAD, ahead, дата.

---

2026-09-29 | spec-031-rhcsa-bank-fixes — прогон AgentTeams закрыт (writer + qc, verdict PASS)

HEAD: 194db93

ahead: 0

План: spec 031 (approved); C-PLAN v1.1

Фаза: spec-031 — AgentTeams-прогон (t1–t6 + QC t7) завершён

Текущая активность: банк приведён к objectives RHEL 10 — `fp_002` удалён, `sec_007` переписан (`firewall` → `firewalld` + `_meta`), добавлены `msw_015`/`msw_016` (Flatpak), `_order.json`/`_topics.json` = 225 / `manage_software` 16, §«Соответствие банка» в spec 030 приведена к факту. Изменения НЕ закоммичены: 5 файлов банка + spec 030 (88 insertions / 56 deletions).

Дальше: approve капитана → интеграционный шаг (`npm run sync` → коммит задачи → `chore(state): converge` → `sync:check` = 0). Открытые follow-up: правка фикстур `e2e/quiz-flow.spec.ts` (сидирует удалённый `fp_002`), постоянный инструмент `_order.json` — spec 032.

<!-- meta updated: 2026-09-29T12:50:56Z entries_count: 3 -->
