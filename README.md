<img src="public/logo.svg" width="88" align="right" alt="sqlfmt-houのロゴ">

# sqlfmt-hou

[![CI](https://github.com/miruky/sqlfmt-hou/actions/workflows/ci.yml/badge.svg)](https://github.com/miruky/sqlfmt-hou/actions/workflows/ci.yml)
[![Deploy](https://github.com/miruky/sqlfmt-hou/actions/workflows/deploy.yml/badge.svg)](https://github.com/miruky/sqlfmt-hou/actions/workflows/deploy.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

**SQLをブラウザだけで整形し、識別子の引用符(`` ` `` / `"` / `[]`)とLIMIT句を方言に合わせて書き換えるツール。**

公開ページ: https://miruky.github.io/sqlfmt-hou/

## 概要

手元に届くSQLは、ログから拾った1行の塊だったり、MySQLの backtick とSQL Serverの角括弧が混ざったものだったりする。読める形に整えて、いま使うデータベースの方言に直す——この2つを一度にやるのがsqlfmt-houで、貼り付ければ即座に右ペインへ結果が出る。サーバーには何も送らない。

整形は「主要句(SELECT・FROM・WHEREなど)の前で改行し、中身を1段下げ、AND/ORで折り返す」という保守的な規則に絞っている。方言変換は確実に機械変換できる2点だけを扱う: 識別子の引用符の付け替えと、`LIMIT n OFFSET m` ↔ `FETCH FIRST` ↔ `TOP n` の書き換えだ。

## アーキテクチャ

![処理の流れ](docs/architecture.svg)

トークナイザが文字列リテラル・引用識別子・コメントを塊として切るので、整形と変換がリテラルの中身を壊すことはない。整形器は構文木を作らず、トークン列上の規則だけで並べ直す——壊れたSQLでも例外を投げず、できる範囲で整える。

## 技術スタック

| 領域                 | 採用技術                       |
| -------------------- | ------------------------------ |
| 言語                 | TypeScript 5(strict、依存ゼロ) |
| ビルド               | Vite                           |
| テスト               | Vitest                         |
| リンタ・フォーマッタ | ESLint + Prettier              |
| CI / 配信            | GitHub Actions + GitHub Pages  |

## 使い方

[公開ページ](https://miruky.github.io/sqlfmt-hou/)にSQLを貼り、方言を選ぶ。

```sql
-- 入力(MySQL風)
select u.id, count(o.id) as orders from users u
left join orders o on o.user_id = u.id
where u.active = 1 group by u.id order by orders desc limit 10 offset 20
```

```sql
-- 出力(標準SQL)
SELECT u.id,
  COUNT(o.id) AS orders
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.active = 1
GROUP BY u.id
ORDER BY orders DESC
OFFSET 20 ROWS
FETCH NEXT 10 ROWS ONLY
```

方言変換の対応表:

| 入力                               | 標準SQL                                  | MySQL        | SQL Server                         |
| ---------------------------------- | ---------------------------------------- | ------------ | ---------------------------------- |
| `` `name` `` / `"name"` / `[name]` | `"name"`                                 | `` `name` `` | `[name]`                           |
| `LIMIT 10`                         | `FETCH FIRST 10 ROWS ONLY`               | `LIMIT 10`   | `SELECT TOP 10`                    |
| `LIMIT 10 OFFSET 20`               | `OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY` | そのまま     | 標準形(OFFSETはORDER BY必須のため) |

ライブラリとしても使える:

```ts
import { format } from './src';

format('select `id` from t limit 5', { dialect: 'sqlserver' });
// "SELECT TOP 5 [id]\nFROM t\n"
```

## プロジェクト構成

- `src/`
  - `tokenize.ts` — 文字列・引用識別子・コメントを壊さないトークナイザ
  - `format.ts` — 整形と方言変換(LIMIT・引用符)
  - `main.ts` + `index.html` — 2ペインのUI
- `.github/workflows/` — CIとPagesデプロイ

## はじめ方

前提: Node.js 22以上。

```
git clone https://github.com/miruky/sqlfmt-hou.git
cd sqlfmt-hou
npm install
npm run dev     # 開発サーバー
npm test        # Vitest
npm run lint    # ESLint
npm run build   # 型チェック + ビルド
```

## 設計方針

**構文木を作らない。** SQLの完全な文法は方言ごとに膨大で、パーサを持つと「パースできないSQLは整形できない」道具になる。トークン列上の規則だけで動くので、CTEやウィンドウ関数を含むSQLも(特別扱いはないが)壊さずに通る。

**変換は嘘をつかない範囲だけ。** 引用符とLIMIT句は意味を保って機械変換できるが、関数名(`IFNULL`↔`COALESCE`)や型名の差は文脈依存で、誤変換は黙った破壊になる。やらないことはこの表の外に置き、手で直す対象として残す。

**入力を信用しない。** 閉じていない文字列・括弧の不一致でも例外を投げず、読めたところまで整形する。整形ツールが落ちるのが一番困る場面は、まさに壊れたSQLを整えようとしている時だからだ。

## ライセンス

[MIT](LICENSE)
