import { describe, expect, it } from 'vitest';

import { decodeState, encodeState, type ShareState } from './share';

const sample: ShareState = {
  sql: "select * from t where name = 'お名前' -- コメント",
  dialect: 'mysql',
  uppercase: false,
};

describe('share', () => {
  it('符号化と復号で状態が往復する(日本語を含む)', () => {
    const round = decodeState('#' + encodeState(sample));
    expect(round).toEqual(sample);
  });

  it('先頭の#が無いハッシュも読める', () => {
    expect(decodeState(encodeState(sample))).toEqual(sample);
  });

  it('sパラメータが無ければnull', () => {
    expect(decodeState('#dialect=mysql')).toBeNull();
    expect(decodeState('')).toBeNull();
  });

  it('壊れた値はnullを返す', () => {
    expect(decodeState('#s=!!!notbase64!!!')).toBeNull();
  });

  it('未知の方言は弾く', () => {
    const bad = encodeState({ ...sample, dialect: 'oracle' as ShareState['dialect'] });
    expect(decodeState('#' + bad)).toBeNull();
  });
});
