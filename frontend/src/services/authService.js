import { apiRequest } from "./api";

export function login(data) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username: data.username,
      password: data.password,
    }),
  });
}
