export interface AnswerRecord {
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
  /** Текст выбранной опции на момент ответа. Стабильный идентификатор выбора,
   *  устойчивый к перестановке options в данных (см. commit 3bc8470). */
  optionText: string;
}
