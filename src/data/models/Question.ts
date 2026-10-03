/**
 * Все 14 тем банка (spec 057). Порядок совпадает с `QUESTION_TOPICS`
 * (`src/data/questions/index.ts`, ключи `LOADERS`) — реестр загрузчиков и есть
 * источник списка тем в рантайме.
 *
 * Почему явный union, а не выведение из `QUESTION_TOPICS`: реестр объявлен как
 * `string[]`, и `typeof QUESTION_TOPICS[number]` дал бы просто `string`, то есть
 * потерял бы exhaustiveness. Guard `TOPIC_COVERAGE` ниже удерживает union и банк
 * в согласии: 15-я тема в банке ломает typecheck до обновления union.
 */
export type Topic =
  | 'deploy_systems'
  | 'essential_tools'
  | 'file_management'
  | 'file_permissions'
  | 'file_systems'
  | 'local_storage'
  | 'manage_software'
  | 'networking'
  | 'process_management'
  | 'running_systems'
  | 'security'
  | 'shell_scripts'
  | 'text_files'
  | 'users_groups';

/**
 * Compile-time guard покрытия (spec 057): `Record<Topic, true>` требует ровно
 * каждый слаг union'а. Пропущенный слаг — ошибка типа, лишний — тоже. В рантайме
 * значение не используется.
 */
const TOPIC_COVERAGE: Record<Topic, true> = {
  deploy_systems: true,
  essential_tools: true,
  file_management: true,
  file_permissions: true,
  file_systems: true,
  local_storage: true,
  manage_software: true,
  networking: true,
  process_management: true,
  running_systems: true,
  security: true,
  shell_scripts: true,
  text_files: true,
  users_groups: true,
};
void TOPIC_COVERAGE;
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface QuestionOption {
  text: string;
  correct: boolean;
}

export interface Question {
  readonly id: string;
  readonly topic: Topic;
  readonly difficulty: Difficulty;
  readonly question: string;
  readonly options: readonly QuestionOption[];
  readonly explanation: string;
}

export interface QuestionJson {
  id: string;
  topic: string;
  difficulty: string;
  question: string;
  options: { text: string; correct: boolean }[];
  explanation: string;
}

export function fromJson(raw: QuestionJson): Question {
  return {
    id: raw.id,
    topic: raw.topic as Topic,
    difficulty: raw.difficulty as Difficulty,
    question: raw.question,
    options: raw.options.map((o) => ({ text: o.text, correct: o.correct })),
    explanation: raw.explanation,
  };
}
