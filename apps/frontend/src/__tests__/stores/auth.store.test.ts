import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "../../stores/auth.store";

describe("AuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  });

  it("should set auth state on login", () => {
    const user = {
      id: "1",
      email: "test@test.com",
      name: "Test",
      roles: ["admin"],
    };
    useAuthStore.getState().setAuth(user, "access-token", "refresh-token");

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe("test@test.com");
    expect(state.accessToken).toBe("access-token");
  });

  it("should clear state on logout", () => {
    useAuthStore
      .getState()
      .setAuth(
        { id: "1", email: "test@test.com", name: "Test", roles: ["admin"] },
        "token",
        "refresh",
      );
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
  });

  it("should check roles correctly", () => {
    useAuthStore
      .getState()
      .setAuth(
        {
          id: "1",
          email: "test@test.com",
          name: "Test",
          roles: ["admin", "analyst_l3"],
        },
        "token",
        "refresh",
      );

    expect(useAuthStore.getState().hasRole("admin")).toBe(true);
    expect(useAuthStore.getState().hasRole("analyst_l1")).toBe(false);
    expect(useAuthStore.getState().hasAnyRole(["admin", "analyst_l1"])).toBe(
      true,
    );
  });
});
