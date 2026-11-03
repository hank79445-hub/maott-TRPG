import palette from '../app/theme-tokens.css?inline'
/** Static entrances do not run Vue; reuse the exact same compiled palette. */
export const entranceTheme =
  palette +
  `
body{background:var(--bg);color:var(--ink)}
main,section,.card{border-color:var(--line)}
main,section,.card{background:var(--panel)}
label,p,pre{color:var(--ink)}
.muted,.hint,small{color:var(--muted)}
input,select,textarea{background:var(--panel);color:var(--ink);border-color:var(--line)}
button,summary,.button,.link-button,.quiet,.login-languages a{background:var(--button-bg);color:var(--ink);border:1px solid var(--button-border)}
button:hover,summary:hover,.button:hover,.link-button:hover,.quiet:hover,.login-languages a:hover{background:var(--button-hover)}
button:disabled{background:var(--button-disabled);color:var(--muted);cursor:not-allowed}
button:focus-visible,summary:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.error,.bad{color:var(--danger)}
`
