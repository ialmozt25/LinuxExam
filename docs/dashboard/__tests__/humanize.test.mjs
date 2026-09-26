import { describe, it, expect } from 'vitest';
import { humanizeCommit } from '../humanize.mjs';

describe('humanizeCommit', () => {
  it('feat(bank) → Добавлены вопросы: ', () => {
    expect(humanizeCommit('feat(bank): M2.9 batch 1 - 6 questions on essential_tools')).toBe(
      'Добавлены вопросы: M2.9 batch 1 - 6 questions on essential_tools'
    );
  });

  it('docs(project) → Документация: ', () => {
    expect(humanizeCommit('docs(project): close milestone M3 (dashboard center)')).toBe(
      'Документация: close milestone M3 (dashboard center)'
    );
  });

  it('feat(dashboard) → Дашборд: ', () => {
    expect(humanizeCommit('feat(dashboard): V6 - unify theme tokens with main app')).toBe(
      'Дашборд: V6 - unify theme tokens with main app'
    );
  });

  it('fix(parser) → Исправление: ', () => {
    expect(humanizeCommit('fix(parser): section status respects bare checkboxes')).toBe(
      'Исправление: section status respects bare checkboxes'
    );
  });

  it('chore(repo) → Обслуживание: ', () => {
    expect(humanizeCommit('chore(repo): close cleanup')).toBe('Обслуживание: close cleanup');
  });

  it('feat(tools) → Инструменты: ', () => {
    expect(humanizeCommit('feat(tools): M3.2 - gen-state.mjs')).toBe('Инструменты: M3.2 - gen-state.mjs');
  });

  it('неизвестный префикс — as-is', () => {
    expect(humanizeCommit('random text')).toBe('random text');
  });

  it('null → пустая строка', () => {
    expect(humanizeCommit(null)).toBe('');
  });

  it('undefined → пустая строка', () => {
    expect(humanizeCommit(undefined)).toBe('');
  });

  it('пустая строка → пустая строка', () => {
    expect(humanizeCommit('')).toBe('');
  });

  it('префикс учитывается только в начале строки', () => {
    expect(humanizeCommit('fix: feat(bank): 6 questions')).toBe('fix: feat(bank): 6 questions');
  });

  it('регистр префикса не важен (i-флаг)', () => {
    expect(humanizeCommit('FEAT(BANK): 7 questions')).toBe('Добавлены вопросы: 7 questions');
  });
});
