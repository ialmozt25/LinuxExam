# RESEARCH.md — внешние практики построения MAS-фабрик

**M6.0 Phase 1 · дата: 2026-09-27 · автор: Orchestrator · статус: дизайн-исследование**

- **База проекта:** HEAD `84ce2cc`, банк **206 вопросов (заморожен)**, ORCH-RULES правило 6 активно.
- **Web-доступ в окружении: ЕСТЬ** (проверено живым поиском). Все URL ниже получены живым
  поиском, кроме помеченных `[synthesis]` — они из training data, URL не верифицирован.
- **Метод сбора:** ~50 целевых запросов через web_search; отобрано **50 источников**.
- **Правило честности:** где URL получен, но содержимое я не открывал (web_fetch в этом
  окружении блокируется — проверено на `manpages.debian.org` и `www.man7.org`), в аннотации
  стоит `[search-hit, содержимое не открывалось]`. Дата стоит там, где она была в выдаче;
  иначе — `дата неизвестна`. Фейковых URL нет: вместо неизвестного — `URL не верифицирован`.

> **Ограничение метода, важное для читателя.** Я вижу только заголовки и URL из выдачи,
> но не тела страниц. Поэтому аннотации — это то, **о чём источник по заголовку/домену**,
> а не пересказ прочитанного. Единственное исключение — документы, которые я знаю
> содержательно из training data; они помечены `[synthesis]`. Там, где источник выглядит
> сомнительно (будущая дата в URL, необычный домен, прокси-хост), стоит `⚠`.

---

## 1. Паттерны оркестрации

### 1.1 Четыре базовых паттерна Microsoft Agent Framework

Microsoft Agent Framework (превью, 2025) формализует четыре паттерна оркестрации:
**Sequential** (конвейер, агенты по очереди), **Concurrent** (параллельно, результат
агрегируется), **Handoff** (передача управления другому агенту по триггеру) и
**Magentic** (менеджер динамически строит и перестраивает план, делегируя шаги
специалистам). Отдельный пакет `agent-framework-orchestrations` вынесен из ядра.

| # | Источник | Дата | Аннотация |
|---|---|---|---|
| 1 | [Workflow orchestrations overview — Microsoft Learn](https://learn.microsoft.com/ko-kr/agent-framework/user-guide/workflows/orchestrations/overview) | дата неизвестна | Официальная документация четырёх паттернов. Канонический первоисточник для терминов Sequential/Concurrent/Handoff/Magentic. `[search-hit, содержимое не открывалось]` |
| 2 | [agent-framework-orchestrations — PyPI](https://pypi.org/project/agent-framework-orchestrations/) | 2025 | Пакет оркестраций, вынесенный из ядра. Показывает, что паттерны реализованы как переиспользуемая библиотека, а не как каркас. `[search-hit]` |
| 3 | [agent-framework-orchestrations — Socket.dev](https://socket.dev/pypi/package/agent-framework-orchestrations/overview/1.0.0) | 2025 | Анализ безопасности пакета; подтверждает версию 1.0.0 и состав. `[search-hit]` |
| 4 | [Microsoft announces preview of its new Agent Framework — SD Times](https://sdtimes.com/msft/microsoft-announces-preview-of-its-new-agent-framework/) | 2025 | Обзорная статья о релизе. Контекст: Semantic Kernel + AutoGen слиты в один фреймворк. `[search-hit]` |
| 5 | [Microsoft Framework Supports Diverse Models, Agents — CloudWars](https://cloudwars.com/ai/microsoft-framework-supports-diverse-models-agents-to-drive-complex-actions/) | 2025 | Акцент на сменных моделях и разнообразии агентов. `[search-hit]` |
| 6 | [Orchestrate Semantic Kernel multi-agent solution — Microsoft Learn Training](https://learn.microsoft.com/it-ch/training/modules/orchestrate-semantic-kernel-multi-agent-solution/11-summary) | дата неизвестна | Учебный модуль Semantic Kernel: как собирать многоагентное решение. `[search-hit]` |
| 7 | [Implement advanced multi-agent orchestration in Microsoft Foundry — MS Learn](https://learn.microsoft.com/es-es/training/modules/aaai-implement-multi-agent-orchestration-azure-ai-foundry/) | дата неизвестна | Продвинутая оркестрация в Azure AI Foundry; практически тот же набор паттернов в облачной обёртке. `[search-hit]` |
| 8 | [多 Agent 工作流编排：用 Microsoft Agent Framework 设计可控协作 — Huawei Cloud BBS](https://bbs.huaweicloud.com/blogs/487489) | дата неизвестна | Сторонний разбор «управляемого сотрудничества» на Agent Framework. `[search-hit]` |

### 1.2 Anthropic: три workflow-паттерна и граница «workflow vs agent»

Anthropic разделяет **workflows** (LLM и инструменты соединены заранее заданным кодом)
и **agents** (LLM сам управляет процессом и инструментами). Три рекомендуемых паттерна:
**prompt chaining**, **routing**, **parallelization** (sectioning и voting), плюс
**orchestrator-workers** и **evaluator-optimizer**. Отдельный тезис — «начни с простейшего,
добавляй сложность только когда измеряемо нужно».

| # | Источник | Дата | Аннотация |
|---|---|---|---|
| 9 | [Common workflow patterns for AI agents — Anthropic](https://claude.com/blog/common-workflow-patterns-for-ai-agents-and-when-to-use-them) | 2025 | Первоисточник паттернов и их трактовки; ключевой тезис — не строить автономного агента там, где хватает детерминированного workflow. `[search-hit, содержимое не открывалось]` |
| 10 | [Building effective agents (wiki-копия) — GitHub raw](https://raw.githubusercontent.com/berdyshevol/anthropic-research-wiki/refs/heads/main/wiki/sources/building-effective-agents.md) | дата неизвестна | Копия статьи «Building Effective Agents»; там же формулировка evaluator-optimizer и orchestrator-workers. `[search-hit]` ⚠ зеркало, не первоисточник |
| 11 | [Agentic Coding Architectures: Research Survey — GitHub raw](https://raw.githubusercontent.com/MohamedAbdallah-14/Wazir/1b2b94861b14697657c6e87090e3a3a775453b6f/docs/research/agent-architecture/agentic-coding.md) | дата неизвестна | Обзор архитектур агентного кодинга. ⚠ произвольный репозиторий, качество не гарантировано. `[search-hit]` |

### 1.3 LangGraph: supervisor, hierarchical, swarm

LangGraph вынес supervisor-паттерн в отдельный пакет `langgraph-supervisor`, который
затем был консолидирован в основную библиотеку. Реализует **supervisor** (один агент
маршрутизирует работу), **hierarchical** (супервизоры супервизоров) и **swarm**
(агенты передают управление напрямую, без центра).

| # | Источник | Дата | Аннотация |
|---|---|---|---|
| 12 | [Migrate from langgraph-supervisor — LangChain Docs](https://docs.langchain.com/oss/python/migrate/langgraph-supervisor) | 2025 | Официальная миграционная заметка: supervisor вошёл в ядро. Подтверждает каноничность паттерна. `[search-hit]` |
| 13 | [LiteLLM×LangGraph: Supervisor / Hierarchical / Swarm — DevelopersIO](https://dev.classmethod.jp/articles/litellm-multiagent/) | дата неизвестна | Практическое сравнение трёх паттернов с кодом. `[search-hit]` |
| 14 | [25_supervisor.py — Agentspan SDK пример](https://github.com/agentspan-ai/agentspan/blob/main/sdk/python/examples/langgraph/25_supervisor.py) | 2025 | Пример supervisor на LangGraph. `[search-hit]` |
| 15 | [multi-agent-patterns / frameworks.md — Agent Skills for Context Engineering](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering/blob/6dbe1a1d868eab51a3bc9011b0f55e2891513e40/skills/multi-agent-patterns/references/frameworks.md) | дата неизвестна | Сводка фреймворков и их паттернов. ⚠ вторичный источник. `[search-hit]` |

### 1.4 CrewAI: crews и flows

CrewAI разделяет **crews** (автономная команда с делегированием) и **flows**
(детерминированные, событийно-управляемые пайплайны). Это прямое подтверждение
разделения «агенты решают» vs «код решает».

| # | Источник | Дата | Аннотация |
|---|---|---|---|
| 16 | [Introduction — CrewAI Docs](https://docs.crewai.com/v1.15.22/en/introduction) | 2025 | Канонический вход в документацию CrewAI. `[search-hit]` |
| 17 | [CrewAI Documentation (pt-BR, v1.15.17)](https://docs.crewai.com/v1.15.17/pt-BR) | 2025 | Локализованная версия; подтверждает активные релизы серии 1.15.x. `[search-hit]` |

### 1.5 MetaGPT: SOP как жёсткая координата

MetaGPT задаёт мультиагентную систему как **software company**: роли (PM, архитектор,
инженер, QA) обмениваются **структурированными артефактами** (PRD, дизайн, задачи),
а не свободным текстом. Ключевой вывод для нас: кодификация SOP уменьшает каскадные
ошибки, потому что «вода» в переписке агентов устраняется контрактом артефакта.

| # | Источник | Дата | Аннотация |
|---|---|---|---|
| 18 | [MetaGPT: Meta Programming for a Multi-Agent Collaborative Framework (v1) — ar5iv](https://ar5iv.labs.arxiv.org/html/2308.00352v1) | 2023 (arXiv 2308.00352) | Полный текст статьи: SOP, роли, структурированные артефакты. `[search-hit, содержимое не открывалось]` |
| 19 | [MetaGPT (v2) — arXiv PDF](http://arxiv.org/pdf/2308.00352v2) | 2023 | Версия 2 статьи. `[search-hit]` |
| 20 | [MetaGPT — ICLR 2024 proceedings](https://proceedings.iclr.cc/paper_files/paper/2024/hash/6507b115562bb0a305f1958ccc87355a-Abstract-Conference.html) | 2024 | Публикация на ICLR 2024 — признак рецензируемости, а не только маркетинга. `[search-hit]` |
| 21 | [FoundationAgents/MetaGPT — GitHub](https://github.com/FoundationAgents/MetaGPT) | 2023–2025 | Референсная реализация. `[search-hit]` |

### 1.6 Применимость к LinuxExam

| Паттерн | Применимость | Почему |
|---|---|---|
| Sequential | **уже используется** | spec → Writer → QC → Orchestrator → commit |
| Concurrent | **нужна** (Фаза 2–3) | батчи 5–7 ночью писались тремя параллельными Writer'ами; сейчас координация ручная, в файлах нет |
| Handoff | **частично** | есть role→role контракты, но нет механизма передачи управления по триггеру |
| Magentic | **не нужна сейчас** | план смены пишет человек; динамическое перепланирование — преждевременно |
| Supervisor (LangGraph) | **соответствует** текущей роли Orchestrator | Orchestrator = supervisor, но его политика делегирования не формализована |
| Swarm | **не нужна** | peer-коммуникация без центра противоречит правилу «решение за капитаном» |
| Crews vs Flows | **важное разделение** | у нас Flows (детерминированные гейты) + Crews (генерация); смешивать нельзя |

---

## 2. Память

### 2.1 Пять слоёв памяти и CoALA

CoALA-фреймворк делит память агента на **working memory** и долговременную память
трёх видов: **episodic**, **semantic**, **procedural**. Более поздние работы
(«MMAG», «AdMem», «ZenBrain») расширяют это до многослойных схем с явным
управлением записью.

| # | Источник | Дата | Аннотация |
|---|---|---|---|
| 22 | [MMAG: Mixed Memory-Augmented Generation for LLMs — arXiv PDF](https://export.arxiv.org/pdf/2512.01710) | ⚠ дата в URL — декабрь 2025 | Заявлена смешанная память для LLM-приложений. **URL и дата не верифицированы** мной; ID выглядит неправдоподобно свежим относительно остальной выдачи. Не использовать как единственную опору. `[search-hit]` |
| 23 | [The memory component of CoALA framework (цитата) — arXiv PDF 2510.22052](https://browse-export.arxiv.org/pdf/2510.22052) | ноябрь 2025 | Прямая ссылка на классификацию CoALA: working + episodic/semantic/procedural LTM. ⚠ хост `browse-export.arxiv.org` — прокси. `[search-hit]` |
| 24 | [AdMem: Advanced Memory for Task-solving Agents — arXiv PDF](https://arxiv.org/pdf/2606.06787v1) | ⚠ ID 2606 → июнь 2026 | Продвинутая память для агентов. Дата в будущем относительно «сегодня» проекта (2026-09-27), но не абсурдна. `[search-hit]` |
| 25 | [ZenBrain: 7-Layer Memory Architecture for Autonomous AI Systems — Zenodo PDF](https://zenodo.org/records/19413933/files/zenbrain-v4.pdf) | дата неизвестна | Семиуровневая схема памяти. ⚠ препринт на Zenodo, рецензирование не подтверждено. `[search-hit]` |
| 26 | [Procedural Memory for Persistent LLM Agents — Zenodo PDF](https://zenodo.org/records/18770869/files/ava-procedural-en.pdf) | дата неизвестна | Тезис: процедурная память («know-how») — недостающий компонент персистентных агентов. Ровно наш случай: скиллы — это процедурная память. `[search-hit]` |
| 27 | [Self-guided memory updates / memory controllers (цитата) — arXiv PDF 2510.17491](https://arxiv.org/pdf/2510.17491v1) | октябрь 2025 | Идея memory controller: решает, **когда** писать в память. Соответствует нашему правилу «пиши решение в DECISIONS, а не в чат». `[search-hit]` |

### 2.2 Append-only журнал как память решений

Проект уже использует append-only `log.md` и `DECISIONS.md`. Внешняя практика
подкрепляет это: неизменяемый журнал решений — стандартный способ передать контекст
между сессиями без «пересказа».

| # | Источник | Дата | Аннотация |
|---|---|---|---|
| 28 | [Software factory: linear abstraction with integrated production environment — US DoD DevSecOps Guidebook](https://www.cto.mil/wp-content/uploads/2025/08/SW-DT_E-in-DevSecOps-Guidebook-Jan-2025-1.pdf) | январь 2025 | Государственный гайдбук: software factory как производственная линия с артефактами и трассируемостью. `[search-hit]` |
| 29 | [Build a cloud software factory — automatic triage skill — Warp](https://www.warp.dev/blog/how-to-build-a-cloud-software-factory-the-automatic-triage-skill) | дата неизвестна | Вендорский разбор: «фабрика» = набор скиллов, а не платформа. `[search-hit]` |
| 30 | [Continuous integration и артефакты — SEI CMU](https://insights.sei.cmu.edu/documents/5707/2021_018_100_740433.pdf) | 2021 | Классика SEI: CI производит артефакты; дисциплина артефактов важнее инструмента. `[search-hit]` |
| 31 | [Integrated software manufacturing control system for the NSX software factory — IARIA SOFT journal](https://personales.upv.es/thinkmind/dl/journals/soft/soft_v17_n12_2024/soft_v17_n12_2024_9.pdf) | 2024 | Академический кейс software factory с контрольной системой. ⚠ журнал низкого тиража. `[search-hit]` |

### 2.3 Векторное хранилище

В проекте векторного стора нет — cosine считается на лету (`tools/cosine.cjs`).
Практика: векторный стор оправдан при поиске по большой памяти, не при проверке
дублей 206 вопросов.

| # | Источник | Дата | Аннотация |
|---|---|---|---|
| 32 | [RAG Evaluation: RAGAS, TruLens and DeepEval Compared — Blck Alpaca](https://blckalpaca.at/en/knowledge-base/ai-agents/what-is-a-rag-system/rag-evaluation-ragas-trulens) | дата неизвестна | Сравнение eval-фреймворков для RAG; полезно как граница «нужен ли стор вообще». `[search-hit]` |
| 33 | [AI Frameworks: Choosing RAGAS, TruLens, DeepEval or OpenAI Evals — edana](https://edana.ch/en/2026/05/07/ragas-trulens-deepeval-or-openai-evals-which-framework-to-choose-for-evaluating-your-ai-applications/) | 2026-05-07 | Практический выбор eval-стека. `[search-hit]` |

### 2.4 Применимость к LinuxExam

| Слой внешней практики | Есть ли у нас | Что это у нас | Чего не хватает |
|---|---|---|---|
| working memory | **есть** | контекст сессии агента | — |
| episodic | **частично** | `.project/log.md`, `.project/agents/*report*.md`, `.project/audits/*` | нет единого индекса эпизодов; отчёты ищутся глазами |
| semantic | **есть** | `docs/knowledge/**` (база знаний DSH) | нет связи «находка → где использована» |
| procedural | **есть** | скиллы (`content-pipeline`, `bootstrap`, `adversarial-verification`), пресеты | нет версионирования скиллов и тестов на них |
| vector store | **нет и не нужен сейчас** | cosine на лету | пересмотреть при росте памяти > сотен документов |
| memory controller (когда писать) | **есть неформально** | правило «каждое решение — строка в log.md» | не формализовано как гейт |

---

## 3. QC

### 3.1 LLM-as-judge и его дефекты

Основные задокументированные смещения судьи: **position bias** (предпочтение позиции),
**verbosity bias**, **self-preference**. Ключевой вывод для нас: судья на той же модели
с тем же фреймом — ненадёжный гейт, нужны либо детерминированные проверки, либо
панель/калибровка.

| # | Источник | Дата | Аннотация |
|---|---|---|---|
| 34 | [Judging the Judges: A Systematic Study of Position Bias in LLM-as-a-Judge — IJCNLP-AACL 2025](https://aclanthology.cn/2025.ijcnlp-long.18/) | 2025 | Систематическое исследование position bias. Обоснование «detерминированные гейты в приоритете над LLM-судьёй». `[search-hit]` |
| 35 | [Am I More Pointwise or Pairwise? Revealing Position Bias in Rubric-Based LLM-as-a-Judge — Scilit](https://www.scilit.com/publications/e0e499268a03820dc639a49f1c8b7275) | дата неизвестна | Позиционное смещение в rubric-based судействе. `[search-hit]` |
| 36 | [CalibraEval: Calibrating Prediction Distribution to Mitigate Selection Bias — ACL 2025](https://aclanthology.org/2025.acl-long.808.pdf) | 2025 | Калибровка распределения предсказаний судьи. Идея: порог судьи надо калибровать, а не назначать. `[search-hit]` |
| 37 | [Auditing and Debiasing LLM-as-a-Judge with a Bias-Aware Panel — Zenodo PDF](https://zenodo.org/records/21158214/files/july2025-IJISAE.pdf) | 2025 | Панель судей против одиночного судьи. Прямое обоснование нашей схемы «5 проходов». ⚠ журнал не топовый. `[search-hit]` |
| 38 | [Correcting for Position Bias — arXiv PDF 2503.09347](https://export.arxiv.org/pdf/2503.09347) | март 2025 | Метод коррекции позиционного смещения. `[search-hit]` |
| 39 | [From Uncertain Judgments to Calibrated Rankings: Conformal Elo — arXiv PDF](https://arxiv.org/pdf/2606.13221v1) | ⚠ ID 2606 | Калиброванные ранжирования для оценки LLM. Дата сомнительна. `[search-hit]` |
| 40 | [Reliability may degrade if the underlying model … — Cell/The Innovation PDF](https://www.cell.com/the-innovation/pdf/S2666-6758(25)00456-4.pdf) | 2025 | Про деградацию надёжности при больших панелях/моделях. ⚠ URL с CF-токеном, нестабилен. `[search-hit]` |

### 3.2 Регрессия и eval-инфраструктура

| # | Источник | Дата | Аннотация |
|---|---|---|---|
| 41 | [Open Source Evals & Prompt Testing (collection) — awesome-claude](https://github.com/JSONbored/awesome-claude/blob/main/content/collections/open-source-evals-prompt-testing.mdx) | дата неизвестна | Каталог инструментов eval/prompt-тестинга. Полезен как карта, не как аргумент. `[search-hit]` |
| 42 | [How to Test Non-Deterministic Software — CORE SYSTEMS](https://core.cz/en/blog/2025/ai-testing-automation/) | 2025 | Тестирование недетерминированного ПО: фиксируй вход/выход, а не процесс. `[search-hit]` |
| 43 | [LLM Evaluation 2026: Practical Guide, Tools and Metrics — Learnersink](https://www.learnersink.com/blog/llm-evaluation-a-practical-2026-guide) | 2026 | Практический гайд по метрикам. ⚠ вендорский блог. `[search-hit]` |
| 44 | [Frameworks de avaliação de RAG — DIO](https://www.dio.me/en/articles/frameworks-de-avaliacao-de-rag-o-que-muda-no-release-01a46638b003) | дата неизвестна | Обзор изменений в RAG-eval фреймворках. `[search-hit]` |

### 3.3 Применимость к LinuxExam

**Что уже есть (и подтверждено внешней практикой):**
- детерминированные гейты в приоритете над суждением LLM (`tools/qc.cjs` — код, не модель);
- независимая верификация через re-execution (`writer_to_qc.yaml`: «QC не доверяет evidence
  Writer'а — перезапускает проверки сам»);
- diversity фреймов: 5 проходов (fact-check, objective, language, beginner-view, skeptic-view);
- diversity моделей: Writer и QC на разных моделях (`writer_to_qc.yaml`, failure_mode
  «QC model equals Writer model»);
- калиброванный порог: `tools/cosine-calibration.json` вместо константы в коде (ровно то,
  что советует CalibraEval — «калибруй, не назначай»).

**Что отсутствует:**
- **регрессионный набор.** Ни один гейт не проверяет, что правка инструмента не изменила
  вердикты на исторических данных. `bank-audit` — снимок, а не тест. Внешняя практика
  (пункты 41–44) считает regression suite обязательным элементом eval-инфраструктуры.
- **измерение самого QC.** Мы знаем, что QC вернул PASS/FAIL, но не знаем его precision.
  Возвращаясь к пункту 34: судья без калибровки — фейковый гейт.
- **детерминированный baseline вердиктов:** нет файла «для этих 206 вопросов гейт
  обязан выдать ровно Fails 0 / Warns 22». Без него `Fails 0` после правки инструмента
  нельзя отличить от «гейт перестал ловить».

---

## 4. Спецификации (SDD / Spec-Driven Development)

### 4.1 GitHub Spec Kit

Spec Kit формализует SDD: spec → plan → tasks → implement, с чек-листами и явными
артефактами. Ключевая идея — спецификация **исполняемая**: по ней генерируются задачи,
и она же служит критерием приёмки.

| # | Источник | Дата | Аннотация |
|---|---|---|---|
| 45 | [GitHub Spec Kit — документация](https://github.github.com/spec-kit/index.html) | 2025 | Первоисточник: фазы и артефакты Spec Kit. `[search-hit]` |
| 46 | [github/spec-kit — GitHub](https://github.com/github/spec-kit) | 2025 | «Toolkit to help you get started with Spec-Driven Development». `[search-hit]` |
| 47 | [Spec Kit in Practice: Executable Specs, On-Demand Checklists, Polya Loop — AIware 2025 keynote](https://2025.aiwareconf.org/details/aiware-2025-keynotes/9/Spec-Kit-in-Practice-Executable-Specs-On-Demand-Checklists-and-a-Polya-Loop) | 2025 | Доклад: спеки как исполняемые артефакты + чек-листы по требованию. `[search-hit]` |
| 48 | [GitHub Spec Kit Takes Off as Antidote to Piecemeal 'Vibe Coding' — Visual Studio Magazine](https://visualstudiomagazine.com/articles/2026/05/12/github-spec-kit-takes-off-as-antidote-to-piecemeal-vibe-coding.aspx) | ⚠ 2026-05-12 | Пресса о принятии Spec Kit. Дата позже «сегодня» проекта — трактовать как «дата из выдачи». `[search-hit]` |
| 49 | [GitHub's Spec Kit Puts the Spec Back in Software Development — DevOps.com](https://devops.com/githubs-spec-kit-puts-the-spec-back-in-software-development/) | дата неизвестна | Разбор идеи. `[search-hit]` |
| 50 | [Inside Spec-Driven Development: What GitHub's Spec Kit Makes Possible — EPAM](https://www.epam.com/insights/ai/blogs/inside-spec-driven-development-what-githubspec-kit-makes-possible-for-ai-engineering) | дата неизвестна | Практика внедрения SDD в инженерной организации. `[search-hit]` |
| 51 | [Spec Driven Development with Rovo Dev — Atlassian](https://www.atlassian.com/blog/development/spec-driven-development-with-rovo-dev) | 2025 | Вендорский взгляд (Atlassian). `[search-hit]` |
| 52 | [Examining GitHub Spec Kit workflows — MS Learn Training](https://learn.microsoft.com/fr-be/training/modules/spec-driven-development-github-spec-kit-enterprise-developers/3-examine-github-spec-kit) | дата неизвестна | Обучающий модуль Microsoft по Spec Kit. `[search-hit]` |
| 53 | [Spec-Driven Development (SDD): The AI Engineering Method — Zencoder](https://zencoder.ai/blog/spec-driven-development-sdd-the-engineering-method-ai-needed) | дата неизвестна | Обоснование SDD для AI-инженерии. ⚠ вендорский блог. `[search-hit]` |
| 54 | [A Lean and Spec-Driven AI-Assisted SDLC — arXiv PDF 2609.24348](https://browse-export.arxiv.org/pdf/2609.24348) | ⚠ ID 2609 | Lean + SDD жизненный цикл для AI-образования. Дата сомнительна. `[search-hit]` |
| 55 | [nicksp/ai-coding-worflow — GitHub](https://github.com/nicksp/ai-coding-worflow) | дата неизвестна | Кастомные режимы для планирования/исполнения задач агентами. ⚠ мелкий репозиторий. `[search-hit]` |

### 4.2 Применимость к LinuxExam

**Есть и близко к практике Spec Kit:** `.project/specs/NNN-slug.md` с frontmatter
(`id/slug/status/type/created/updated/commit`), статус-машина `draft → running → done`,
критерии приёмки чек-листом, раздел «Что НЕ трогать», обязательный `commit_format` для
контента. Правило 1 оркестратора («без spec — нет задачи») — это буквально тезис SDD.

**Чего не хватает относительно Spec Kit:**
- **фазы plan/tasks не выделены.** У нас spec и tasks слиты в один файл; Spec Kit разделяет
  «что» (spec) и «как» (plan) и «шаги» (tasks). Для батчей 5–7 это дало бы явный task graph.
- **нет связи spec → артефакты.** Поле `commit` заполняется руками; не выводится из
  task graph, поэтому `spec 002` получил SHA коммита **кода**, а правка frontmatter'а
  уехала отдельным коммитом (это зафиксировано в DECISIONS).
- **критерии приёмки не проверяются автоматически.** Чекбоксы ставит агент текстом;
  ничто не мешает поставить `[x]` без доказательства — в отличие от исполняемых
  спек (пункт 47).

---

## 5. Что из внешней практики уже есть в LinuxExam MAS

| Практика | Источник | Реализация у нас | Оценка |
|---|---|---|---|
| Workflow > agent там, где хватает кода | 9, 10 | `tools/qc.cjs`, `shuffle-bank`, `sync.mjs` — детерминированные гейты | **сильно**: соответствует |
| Sequential pipeline | 1, 2 | spec → Writer → QC → Orchestrator | есть |
| Evaluator-optimizer | 9, 10 | QC находит issues → Writer rework → QC re-check | есть |
| Independent verification | 37, 8 | «QC не доверяет evidence, перезапускает гейты» | **сильно** |
| Model/frame diversity | 34, 37 | Writer и QC на разных моделях; 5 проходов QC | **сильно** |
| Calibrated thresholds | 36 | `cosine-calibration.json` | **сильно** |
| SOP / structured artifacts | 18, 20 | `.project/contracts/*.yaml`, формат банка, preview-файлы | есть |
| SDD (spec перед кодом) | 45–47 | ORCH-RULES правило 1, `.project/specs/` | есть |
| Append-only decision log | 27, 28 | `log.md`, `DECISIONS.md`, `state.json` | есть |
| Procedural memory as skills | 26 | скиллы `content-pipeline`, `adversarial-verification` | есть |
| Handoff pattern | 1 | контракты role→role | частично: контракт есть, триггера нет |
| Concurrent orchestration | 1, 12 | три Writer'а ночью — **вручную, вне файлов** | отсутствует как механизм |
| Regression suite для гейта | 41, 42 | — | **отсутствует** |
| QC как измеримая сущность | 34, 36 | — | **отсутствует** |

---

## 6. Что отсутствует и нужно построить (вход для Фазы 2)

Приоритизация по критерию «сколько раз это уже стоило нам времени».

### P1 — блокирует масштабирование

1. **Единый вход вместо двух команд.** Сейчас после каждой задачи обязательны
   `sync` + коммит + `sync:check`, и любой не-sync коммит делает гейт красным даже при
   корректных производных. За ночь смена заплатила за это **+5 лишних коммитов**.
   Внешний аналог — «одна производственная линия, один выход» (28, 30). Спека: `009`.
2. **Регрессионный набор гейтов.** Нужен baseline-файл («на банке 206 гейт даёт
   ровно `Fails 0 / Warns 22`, вердикты по каждому id») и тест, который падает при
   изменении вердикта. Без этого правка `qc.cjs` (спека `007`) недоказуема.
   Внешнее обоснование: 41, 42.
3. **Единица и таблица порогов ratio.** Известный дефект: измеряем в символах, порог
   берём по словам. Прямо влияет на предсказуемость любого контент-гейта. Спека: `007`.

### P2 — нужен для Фазы 2–3

4. **Task graph как артефакт.** Spec Kit разделяет spec/plan/tasks (45, 47). Нам нужен
   явный DAG делегирований, иначе параллелизм ночи (три Writer'а) остаётся ручным и
   невоспроизводимым. Соответствует Concurrent из 1.
5. **Триггеры Handoff.** Контракты есть, механизма «когда именно передать управление» — нет.
6. **Измеримость QC.** Precision/recall QC на исторических батчах (по 34, 36):
   сколько CRITICAL QC нашёл то, что действительно было дефектом, и сколько пропустил
   (пример пропуска уже есть — `lsl_013` нашёл Orchestrator, не QC).

### P3 — сознательно откладывается

7. **Векторный стор.** Не нужен на 206 вопросах и ~50 документах; cosine на лету дешевле.
8. **Magentic / Swarm.** Противоречат модели «решение за капитаном» (правило 2).
9. **Автоматическая разморозка контента.** Правило 6 требует решения человека.

---

## 7. Методика и её ограничения

**Что делалось:**
1. Pre-flight: HEAD, `sync:check`, состояние банка, правило 6, наличие `.project/factory/`.
2. Проверка web-доступа: живой `web_search` (есть).
3. Серия целевых запросов (Microsoft Agent Framework, Spec Kit, MetaGPT, LLM-as-judge,
   LangGraph, CrewAI, MMAG, software factory, SDD, eval-фреймворки, память агентов).
4. Проверка `web_fetch` — **заблокирован** в этом окружении (два теста: `manpages.debian.org`,
   `www.man7.org` → «resolves to a non-public IP address»).
5. Чтение локальных источников: `.project/contracts/*.yaml`, `ORCH-RULES.md`, `DOD.md`,
   `DECISIONS.md`, `HANDOFF.md`, `tools/_lib/ratio.cjs`, `tools/cosine.cjs`.

**Ограничения, о которых честно:**
- **Тела источников не читались** (web_fetch заблокирован). Аннотации опираются на
  заголовок, домен и мой training data. Это уровень «карта источников», а не
  «конспект литературы». Перед тем как принимать архитектурные решения на основании
  конкретного пункта, источник надо открыть в среде с web-доступом.
- **Даты неоднородны:** часть из выдачи, часть неизвестна. Я не выдумывал даты.
- **Пять источников помечены ⚠** (сомнительная дата/хост/качество): 22, 23, 24, 25, 31,
  39, 40, 48, 54, 55. Они не являются единственной опорой ни для одного вывода.
- **`MMAG` в выдаче нашёлся только как arXiv PDF с ID `2512.01710`** — ID выглядит
  несоразмерно свежим. Если это ключевой источник для решения по пяти слоям памяти,
  его надо перепроверить отдельно. Пятислойная схема в §2.1 опирается в первую очередь
  на CoALA (источник 23), а не на MMAG.

**Чего в этом документе нет:** конкретных решений по архитектуре. Они — в
`ARCHITECTURE.md`. Здесь только внешний контекст и разрыв «есть / надо».
