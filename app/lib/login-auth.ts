export const LOGIN_ACCOUNT = "sean.sie";
export const LOGIN_PASSWORD = "sean002002dus";

export const LOGIN_PROFILE = {
  name: "謝慶宣",
  employeeId: "140901",
} as const;

export function validateLogin(account: string, password: string) {
  return account.trim() === LOGIN_ACCOUNT && password === LOGIN_PASSWORD;
}
