import { describe, expect, it } from 'vitest';
import {
  isTimerTriggerMessage,
  isValidDiceExpr,
  parseInlineTags,
  pendingTagStart,
  type InlineTag,
} from '../features/chat/inlineTags/parse';

/** #130 CP1 — inline action tag grammar (REQ §1). */

const tagsOf = (text: string, streaming = false): InlineTag[] =>
  parseInlineTags(text, { streaming }).flatMap((s) => (s.type === 'tag' ? [s.tag] : []));
const textOf = (text: string, streaming = false): string =>
  parseInlineTags(text, { streaming })
    .map((s) => (s.type === 'text' ? s.text : '§'))
    .join('');

describe('inline tag recognition', () => {
  it('recognises every whitelisted tag with its attributes', () => {
    const text = [
      '<speak emotion="soft">你好</speak>',
      '<spoiler cover="结局" pwd="Rose">他活下来了</spoiler>',
      '<pin>周五交稿</pin><unpin id=3>',
      '<block=30s><block=0s>',
      '<timer=90s title="泡茶"><timer cancel="泡茶">',
      '<timer_fired title="泡茶" fire_at="2026-11-13T16:21:44+01:00">',
      '<roll=2d6+3>',
      '<roll_result expr="1d20" by="assistant" dice="17" total=17>',
    ].join('\n');
    expect(tagsOf(text)).toEqual([
      { kind: 'speak', emotion: 'soft', body: '你好', closed: true },
      { kind: 'spoiler', cover: '结局', pwd: 'Rose', body: '他活下来了', closed: true },
      { kind: 'pin', body: '周五交稿', closed: true },
      { kind: 'unpin', id: 3 },
      { kind: 'block', seconds: 30 },
      { kind: 'block', seconds: 0 },
      { kind: 'timer', seconds: 90, title: '泡茶' },
      { kind: 'timer_cancel', title: '泡茶' },
      { kind: 'timer_fired', title: '泡茶', fireAt: '2026-11-13T16:21:44+01:00' },
      { kind: 'roll', expr: '2d6+3' },
      { kind: 'roll_result', expr: '1d20', by: 'assistant', dice: [17], total: 17 },
    ]);
  });

  it('keeps surrounding text in order around tags', () => {
    expect(textOf('前<timer=5s>中<pin>x</pin>后')).toBe('前§中§后');
  });
});

describe('inline tag exemptions', () => {
  it.each([
    ['comparison', 'if x < y and y > z'],
    ['generic type', 'Vec<String> and Option<Box<T>>'],
    ['unknown html', '<div>card</div><b>bold</b>'],
    ['name prefix only', '<timerx=5s> <rolling> <pinned>'],
    ['bad seconds', '<timer=5m> <block=abc> <timer=0s> <block=86401s>'],
    ['bad dice', '<roll=1d7> <roll=9d6> <roll=d> <roll=2d6-1d4> <roll=5>'],
    ['bad unpin', '<unpin id=abc> <unpin>'],
    ['attribute value on paired tag', '<speak=1>x</speak>'],
  ])('%s stays plain text', (_label, text) => {
    expect(tagsOf(text)).toEqual([]);
    expect(textOf(text)).toBe(text);
  });

  it('ignores tags inside inline code', () => {
    const text = 'use `<timer=5s>` or ``<pin>a</pin>`` literally';
    expect(tagsOf(text)).toEqual([]);
  });

  it('ignores tags inside fenced code but parses after the fence', () => {
    const text = ['```html', '<speak>not voice</speak>', '<roll=1d20>', '```', '<roll=1d20>'].join('\n');
    expect(tagsOf(text)).toEqual([{ kind: 'roll', expr: '1d20' }]);
  });

  it('treats an unterminated fence as code to the end', () => {
    expect(tagsOf('~~~\n<timer=5s>')).toEqual([]);
  });

  it('does not close a paired tag on a closer inside code', () => {
    const [tag] = tagsOf('<spoiler>a `</spoiler>` b</spoiler>');
    expect(tag).toMatchObject({ kind: 'spoiler', body: 'a `</spoiler>` b', closed: true });
  });
});

describe('unclosed paired tags', () => {
  it('an unclosed speak always swallows the rest (REQ §3.1)', () => {
    expect(tagsOf('说完<speak>半截话')).toEqual([
      { kind: 'speak', emotion: null, body: '半截话', closed: false },
    ]);
    expect(textOf('说完<speak>半截话')).toBe('说完§');
  });

  it('a persisted unclosed spoiler / pin stays text', () => {
    expect(tagsOf('<spoiler>秘密')).toEqual([]);
    expect(tagsOf('<pin>记一下')).toEqual([]);
  });

  it('a streaming unclosed spoiler is already masked', () => {
    expect(tagsOf('<spoiler>秘', true)).toEqual([
      { kind: 'spoiler', cover: null, pwd: null, body: '秘', closed: false },
    ]);
  });
});

describe('streaming tail buffering', () => {
  it.each(['<', '<sp', '<speak', '<timer=', '<timer=9', '<roll=2d', '<spoiler cover="结', '</'])(
    'holds back %j',
    (tail) => {
      expect(textOf(`你好${tail}`, true)).toBe('你好');
      expect(pendingTagStart(`你好${tail}`)).toBe(2);
    },
  );

  it.each(['x < y', 'Vec<String', '<div', 'a <x'])('does not hold back %j', (tail) => {
    expect(textOf(tail, true)).toBe(tail);
  });

  it('does not hold back inside code', () => {
    expect(textOf('```\n<sp', true)).toBe('```\n<sp');
    expect(textOf('`a` `<sp`', true)).toBe('`a` `<sp`');
  });

  it('releases a held prefix once it cannot become a tag', () => {
    expect(textOf('a <b', true)).toBe('a ');
    expect(textOf('a <bold>', true)).toBe('a <bold>');
  });

  it('only buffers while streaming', () => {
    expect(textOf('你好<sp')).toBe('你好<sp');
  });
});

describe('dice expressions', () => {
  it.each(['1d20', 'd20', '2d6+3', '1d8+1d6+2', '8d6', '1d100-1', '1d4 + 2'])('%s is valid', (expr) => {
    expect(isValidDiceExpr(expr)).toBe(true);
  });

  it.each(['1d3', '9d6', '5d6+4d6', '0d6', '-1d6', '3', '2d6*2', '1d20+x'])('%s is invalid', (expr) => {
    expect(isValidDiceExpr(expr)).toBe(false);
  });
});

describe('timer trigger messages', () => {
  const trigger = '<timer_fired title="泡茶" fire_at="2026-11-13T16:21:44+01:00">';

  it('a message that is only the trigger is hidden', () => {
    expect(isTimerTriggerMessage(trigger)).toBe(true);
    expect(isTimerTriggerMessage(`\n${trigger}\n`)).toBe(true);
  });

  it('a trigger with other text is shown', () => {
    expect(isTimerTriggerMessage(`${trigger} 到了吗`)).toBe(false);
    expect(isTimerTriggerMessage('`' + trigger + '`')).toBe(false);
  });
});
