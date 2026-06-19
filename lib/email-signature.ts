export function signature(appBase: string) {
  const teal = "#4a9db5"
  const logo = `${appBase}/youthstation-logo.jpg`

  return `
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb">
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr>
          <td style="padding-right:24px;vertical-align:middle">
            <img src="${logo}" alt="YouthStation" width="110" style="display:block;border-radius:4px" />
          </td>
          <td style="padding-left:24px;border-left:2px solid #e5e7eb;vertical-align:top">
            <p style="margin:0 0 2px;font-size:16px;font-weight:700;font-style:italic;color:#111827">Onur Arslan</p>
            <p style="margin:0 0 12px;font-size:13px;font-style:italic;color:#6b7280">Secretary General</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:2px 8px 2px 0">
                  <span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:${teal};text-align:center;line-height:20px;font-size:11px;color:#fff">&#128222;</span>
                </td>
                <td style="font-size:13px;color:#374151;padding-bottom:4px">+33 6 88 85 23 75</td>
              </tr>
              <tr>
                <td style="padding:2px 8px 2px 0">
                  <span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:${teal};text-align:center;line-height:20px;font-size:11px;color:#fff">&#9993;</span>
                </td>
                <td style="font-size:13px;color:#374151;padding-bottom:4px">secretaire@youthstation.org</td>
              </tr>
              <tr>
                <td style="padding:2px 8px 2px 0">
                  <span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:${teal};text-align:center;line-height:20px;font-size:11px;color:#fff">&#9679;</span>
                </td>
                <td style="font-size:13px;color:#374151;padding-bottom:4px">Nancy, France</td>
              </tr>
              <tr>
                <td style="padding:2px 8px 2px 0">
                  <span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:${teal};text-align:center;line-height:20px;font-size:11px;color:#fff">&#127760;</span>
                </td>
                <td style="font-size:13px;color:#374151">
                  <a href="https://www.youthstation.org" style="color:${teal};text-decoration:none">www.youthstation.org</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `
}
