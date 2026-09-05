# 雑記 (Essays)

`/zakki.html` が一覧ページ、`/zakki/YYYY-MM-DD.html` が個別記事です。
記事は素の HTML ファイルなので、GitHub のリポジトリに書き込み権限がある人 (＝リポジトリのオーナー) 以外は
追加も編集もできません。投稿フォームやコメント欄、CMS、データベースは一切使っていません。

## 新しい記事を追加する手順

1. このディレクトリの既存ファイルを `YYYY-MM-DD.html` という名前でコピーする
2. コピーしたファイルの以下を書き換える
   - `<title>` と `<meta name="description">`
   - `<p class="eyebrow">` の日付
   - `<h1 class="hero-title">` のタイトル
   - `<div class="col-body essay-body">` の中の本文 (`<p>` を並べるだけ)
3. `/zakki.html` の記事リストの一番上に `<li class="item">` を追加する
   (テンプレートが `zakki.html` の中にコメントとして書いてあります)
4. main に push すると GitHub Actions が自動でサイトを再デプロイします

## 本文で使える部品

- 段落: `<p>…</p>`
- 注釈番号: `<sup>*1</sup>`
- 画像 + キャプション:

  ```html
  <figure class="essay-figure">
    <img src="../images/example.jpg" alt="">
    <figcaption>キャプション</figcaption>
  </figure>
  ```

- 脚注 / 参考文献:

  ```html
  <div class="essay-notes">
    <p class="eyebrow">Notes</p>
    <ol>
      <li>…</li>
    </ol>
  </div>
  ```

スタイルは `/style-jp.css` の「Essays (雑記)」セクションにまとまっています。
