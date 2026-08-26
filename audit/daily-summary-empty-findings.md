## Screenshot observations

The screenshot is 1500×4576 portrait and was inspected in ordered vertical tiles. In the AI explanation section, the summary says `5 ခု` findings. Visible finding 1 and 2 contain text. Finding 3 and finding 4 render as empty pale-green boxes with only the numbered badge. Finding 5 contains text. Therefore the issue is not missing grid space alone: the data array has five entries, but entries 3 and 4 are blank strings/empty values that are still rendered.

The correct fix is to normalize/filter explanation findings before mapping them into numbered cards. Numbering must be regenerated after filtering so the visible cards become 01, 02, 03 rather than leaving blank 03/04 gaps. The total count must also use the filtered non-empty findings.
