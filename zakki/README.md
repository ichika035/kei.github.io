# 雑記 (Essays)

記事はカテゴリごとにまとめています。

```
/zakki.html                     カテゴリ一覧 (四角いカードが並ぶページ)
/zakki/cat-<slug>.html          カテゴリページ (そのカテゴリの記事一覧)
/zakki/YYYY-MM-DD[-suffix].html 記事本体
/zakki/images/                  記事に埋め込む画像
```

現在のカテゴリ:

| カテゴリ | ファイル |
| --- | --- |
| メディア論オン会 | `cat-media.html` |
| シンガポール | `cat-singapore.html` |

記事は素の HTML ファイルなので、GitHub のリポジトリに書き込み権限がある人 (＝リポジトリのオーナー) 以外は
追加も編集もできません。投稿フォームやコメント欄、CMS、データベースは一切使っていません。

## 記事を追加する手順

1. `zakki/` の既存記事を `YYYY-MM-DD.html` (同じ日に複数書くときは `YYYY-MM-DD-xxx.html`) としてコピーする
2. コピーしたファイルの以下を書き換える
   - `<title>` と `<meta name="description">`
   - 冒頭の戻りリンク `← カテゴリ名` (`href` をそのカテゴリの `cat-*.html` に)
   - `<p class="eyebrow">` の「日付 · カテゴリ名」
   - `<h1 class="hero-title">` のタイトル
   - `<div class="col-body essay-body">` の中の本文
3. そのカテゴリの `cat-<slug>.html` の記事リスト先頭に `<li class="item">` を足す
   (テンプレートが `cat-*.html` の中にコメントとして書いてあります)
4. main に push すると GitHub Actions が自動でサイトを再デプロイします

## カテゴリを追加する手順

1. 既存の `cat-*.html` をコピーして `cat-<英数字のスラッグ>.html` を作り、カテゴリ名・説明・記事リストを書き換える
2. `/zakki.html` の `cat-grid` にカードを足す (テンプレートは `zakki.html` の中のコメント)
   - `cat-count` はそのカテゴリの記事数

## 本文で使える部品

- 段落: `<p>…</p>`
- 見出し: `<h2 class="essay-h2">` / `<h3 class="essay-h3">` / `<h4 class="essay-h4">`
- 箇条書き (入れ子可): `<ul class="essay-list"><li>…<ul><li>…</li></ul></li></ul>`
- 矢印の結論行: `<p class="essay-arrow">…</p>`
- 自分のコメント: `<p class="essay-note">※ …</p>`
- 引用: `<blockquote class="essay-quote">…<cite>— 著者</cite></blockquote>`
- 出典 (記事冒頭):

  ```html
  <div class="essay-source">
    <p class="eyebrow">出典</p>
    <p class="essay-source-title">書名</p>
    <p class="essay-source-meta">著者・訳者など</p>
    <p class="essay-source-desc">内容紹介など</p>
  </div>
  ```

- 画像 + キャプション (2枚並べるときは `cols-2`):

  ```html
  <div class="essay-figs cols-2">
    <figure>
      <img src="./images/example.jpg" alt="" loading="lazy">
      <figcaption>キャプション</figcaption>
    </figure>
  </div>
  ```

- 注釈番号 (クリックで注/引用元へ):
  - 引用元が URL のとき: `<sup class="fn-ref" id="fnref-1"><a href="https://…" target="_blank" rel="noopener">*1</a></sup>`
  - URL がないとき: `<sup class="fn-ref" id="fnref-1"><a href="#fn-1">*1</a></sup>`
- 脚注 / 参考文献:

  ```html
  <div class="essay-notes">
    <p class="eyebrow">Notes</p>
    <ol>
      <li id="fn-1">… <a class="fn-back" href="#fnref-1">↩</a></li>
    </ol>
  </div>
  ```

スタイルは `/style-jp.css` の「Essays (雑記)」以降のセクションにまとまっています。
