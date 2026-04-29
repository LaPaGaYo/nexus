# Design Shotgun Comparison Loop

Use this reference when a Nexus design skill asks to lazy-load the comparison-board loop.

## Serve Board

Run:

```bash
$D compare --images "$_DESIGN_DIR/variant-A.png,$_DESIGN_DIR/variant-B.png,$_DESIGN_DIR/variant-C.png" --output "$_DESIGN_DIR/design-board.html" --serve
```

Run it in the background because the server must stay alive while the user interacts with the board.

Parse `SERVE_STARTED: port=XXXXX`.

## Wait

Use AskUserQuestion only as the blocking wait. Include the board URL:

`http://127.0.0.1:<PORT>/`

Do not ask which variant they prefer in chat unless the board fails. The board is the chooser.

## Read Feedback

Check:

- `$_DESIGN_DIR/feedback.json`
- `$_DESIGN_DIR/feedback-pending.json`

If `feedback.json` exists, read preferred variant, ratings, comments, and overall direction.

If `feedback-pending.json` exists, read `regenerateAction` and optional `remixSpec`, then run `$D iterate` or `$D variants`, regenerate the board, reload the same server, and wait again.

## Save Approval

After confirmation, write `approved.json` next to the board assets with:

- approved variant
- feedback
- date
- screen
- branch
- deliverable type
- export targets
- brief file path
