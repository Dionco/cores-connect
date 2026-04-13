export interface SignatureInput {
  fullName: string;
  role: string;
  phone: string;
  addressLine: string;
  websiteUrl: string;
  websiteLabel: string;
  linkedinUrl: string;
  instagramUrl: string;
  presenceLine?: string;
  locale: 'en' | 'nl';
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeAttr = (value: string): string => escapeHtml(value);

const COPY = {
  en: {
    greeting: 'Dear ...,',
    signoff: 'Kind regards,',
    disclaimer:
      'This email message is intended only for the addressed recipient(s). Disclosure, duplication, distribution, and/or provision of this information to others is not permitted. Cores does not guarantee the accurate and complete transmission of the content of a sent email, nor its timely receipt. If you are not the intended recipient, you are requested to inform the sender and delete the message.',
  },
  nl: {
    greeting: 'Beste ...,',
    signoff: 'Met vriendelijke groet,',
    disclaimer:
      'Dit e-mailbericht is uitsluitend bestemd voor de geadresseerde(n). Openbaarmaking, vermenigvuldiging, verspreiding en/of verstrekking van deze informatie aan derden is niet toegestaan. Cores staat niet in voor de juiste en volledige overbrenging van de inhoud van een verzonden e-mail, noch voor de tijdige ontvangst daarvan. Indien u niet de beoogde ontvanger bent, wordt u verzocht de afzender te informeren en het bericht te verwijderen.',
  },
} as const;

export const buildSignatureHtml = (input: SignatureInput): string => {
  const copy = COPY[input.locale];
  const name = escapeHtml(input.fullName);
  const role = escapeHtml(input.role);
  const phone = escapeHtml(input.phone);
  const address = escapeHtml(input.addressLine);
  const websiteUrl = escapeAttr(input.websiteUrl);
  const websiteLabel = escapeHtml(input.websiteLabel);
  const linkedin = escapeAttr(input.linkedinUrl);
  const instagram = escapeAttr(input.instagramUrl);
  const presenceRow = input.presenceLine
    ? `<td valign="bottom" align="left" width="" style="font: 12px/14px Arial, sans-serif; color: #989999;">${escapeHtml(input.presenceLine)}</td>`
    : '';

  return `<!DOCTYPE html>
<html lang="${input.locale}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cores</title>
  <style type="text/css">
    #outlook a{padding:0;}
    body{width:100% !important;} .ReadMsgBody{width:100%;} .ExternalClass{width:100%;}
    body{-webkit-text-size-adjust:none; -ms-text-size-adjust:none; text-size-adjust:none;}
    body{margin:0; padding:0;}
    img{height:auto; line-height:100%; outline:none; text-decoration:none;-ms-interpolation-mode:bicubic;}
    #backgroundTable{height:100% !important; margin:0; padding:0; width:100% !important;}
  </style>
  <!--[if mso]>
      <style>table{mso-table-lspace:0pt; mso-table-rspace:0pt;}</style>
  <![endif]-->
</head>
<body>
  <table cellspacing="0" cellpadding="0" align="left" border="0" width="100%">
    <tr>
      <td valign="top" align="left" width="100%" style="padding-top: 15px;">
        <table cellspacing="0" cellpadding="0" align="left" border="0" width="100%">
          <tr>
            <td valign="top" align="left" style="font: 14px/18px Arial,sans-serif; color: #000000; padding-bottom: 28px;">
              ${copy.greeting}<br><br><br>
              ${copy.signoff}<br><br>
              <strong>${name}</strong><br>
              <span style="color: #989999;">${role}</span>
            </td>
          </tr>
          <tr>
            <td valign="top" align="left" style="font: 14px/21px Arial,sans-serif; color: #000000; padding-bottom: 28px;">
              <span style="color: #000000;">${phone}<br>${address}<br></span>
              <strong><a href="${websiteUrl}" title="" style="display: block; text-decoration: none; outline: none; border: none; color: #000000;" target="_blank">${websiteLabel}</a></strong>
            </td>
          </tr>
          <tr>
            <td valign="top" align="left" style="padding-bottom: 16px;">
              <table cellspacing="0" cellpadding="0" align="left" border="0" width="100%">
                <tr>
                  <td width="80" style="width:80px;">
                    <table cellspacing="0" cellpadding="0" align="left" border="0">
                      <tr>
                        <td valign="bottom" align="left" width="24" height="24" style="padding-right: 12px;">
                          <a href="${linkedin}" title="" style="display: block; text-decoration: none; outline: none; border: none;" target="_blank">
                            <img src="https://www.cores.nl/wp-content/uploads/2024/02/Linkedin.svg" width="24" height="24" alt="" style="display: block; outline: none; width: 100%; max-width: 24px;" border="0" />
                          </a>
                        </td>
                        <td valign="bottom" align="left" width="24" height="24">
                          <a href="${instagram}" title="" style="display: block; text-decoration: none; outline: none; border: none;" target="_blank">
                            <img src="https://www.cores.nl/wp-content/uploads/2024/02/iconmonstr-instagram-13-1.svg" width="24" height="24" alt="" style="display: block; outline: none; width: 100%; max-width: 24px;" border="0" />
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td>
                    <table cellspacing="0" cellpadding="0" align="left" border="0" width="100%">
                      <tr>${presenceRow}</tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td valign="top" align="left" style="background-color: #284150;">
              <table cellspacing="0" cellpadding="0" align="left" border="0" width="100%">
                <tr>
                  <td valign="middle" align="left" style="padding: 15px 20px;">
                    <img src="https://www.cores.nl/wp-content/uploads/2026/04/footer-logo.png" width="139" height="51" alt="" style="display: block; outline: none; width: 100%; max-width: 139px;" border="0" />
                  </td>
                  <td valign="middle" align="right">
                    <img src="https://www.cores.nl/wp-content/uploads/2026/04/footer-diamond-animation.png" width="173" height="90" alt="" style="display: block; outline: none; width: 100%; max-width: 173px;" border="0" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td valign="top" align="left" style="font: 12px/16px Arial, sans-serif; color: #989999; padding-top: 16px;">
              ${copy.disclaimer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const defaultSignatureInput = (employee: {
  firstName: string;
  lastName: string;
  role: string;
  workPhone: string;
}, locale: 'en' | 'nl' = 'en'): SignatureInput => ({
  fullName: `${employee.firstName} ${employee.lastName}`.trim(),
  role: employee.role,
  phone: employee.workPhone || '+31 (0)85 - 744 05 01',
  addressLine: 'Leeweg 2  1161 AB Zwanenburg',
  websiteUrl: 'https://cores.nl',
  websiteLabel: 'cores.nl',
  linkedinUrl: 'https://www.linkedin.com/company/cores-environment/',
  instagramUrl: 'https://www.instagram.com/cores_environment/',
  presenceLine: '',
  locale,
});
