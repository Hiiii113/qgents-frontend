/** 登录密码加密配置；构建公钥与 keyId 必须匹配后端私钥。 */
import { JSEncrypt } from 'jsencrypt'

/** RSA 公钥 keyId —— 与后端私钥配对 */
export const RSA_KEY_ID = import.meta.env.VITE_RSA_KEY_ID || 'rsa-2026-08'

/** 平台固定 RSA 公钥（PEM 格式） */
const DEFAULT_PUBLIC_KEY = `-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEAttIDG9u/Ag+1odUe5brC+54CFdFfHrjuC15piR73qx2tOquiRboE
UB2Zsq681ABEtaUS2bk1ihjm2kjoHOCwAZgXM2WSS+pAl5yTcfpGY33mpqQGKwgD
erUEhMgEReXD6JSoGRR3vV6CDVmrGbrw4Jhvjbi3WW3bKsEtFtwtF79wbHOp5Huz
IIMY7l7yRljUF7wl1Hnwsc+VfYPnd1KNT0pR7b4z8xOHM7F6rq/jQ1ByEsA4Stnt
x8WJE67C4seMyTOxY5EbVriR4x0lstULjzw8Qkuqu4fOAbVn4+JpfH9CjqvBNecH
Pwyg+E3scliNZYXywo7eMWS1RjkHPcXnnwIDAQAB
-----END RSA PUBLIC KEY-----`

/** 使用 JSEncrypt 实现后端要求的 RSA/ECB/PKCS1Padding 加密。 */
export async function encryptPassword(plainPassword: string): Promise<string> {
  const jsEncrypt = new JSEncrypt()
  jsEncrypt.setPublicKey(import.meta.env.VITE_RSA_PUBLIC_KEY?.replace(/\\n/g, '\n') || DEFAULT_PUBLIC_KEY)
  const cipher = jsEncrypt.encrypt(plainPassword)
  if (!cipher) throw new Error('RSA 加密失败：公钥无效或格式不受支持')
  return cipher
}
