import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentDormitorySection } from "./StudentDormitorySection";

const { getMine, updateMine } = vi.hoisted(() => ({ getMine: vi.fn(), updateMine: vi.fn() }));

vi.mock("@/api/dormitory-api", () => ({
  dormitoryApi: { registrations: { getMine, updateMine } },
}));

describe("StudentDormitorySection", () => {
  beforeEach(() => {
    getMine.mockReset();
    updateMine.mockReset();
  });

  it("does not render a KTX section when the student has no formal registration", async () => {
    getMine.mockResolvedValue({ has_dormitory_registration: false });
    const { container } = render(<StudentDormitorySection />);
    await waitFor(() => expect(getMine).toHaveBeenCalledOnce());
    expect(screen.queryByRole("heading", { name: "Thông tin KTX" })).not.toBeInTheDocument();
    expect(container.querySelector("section")).toBeNull();
  });

  it("sends only API-allowed changed fields and reloads the canonical record", async () => {
    getMine.mockResolvedValue({
      has_dormitory_registration: true,
      editable_fields: ["phone_number"],
      registration: { registration_code: "DK-01", status: "Chờ duyệt", phone_number: "0900000000" },
    });
    updateMine.mockResolvedValue({});
    render(<StudentDormitorySection />);

    await screen.findByRole("heading", { name: "Thông tin KTX" });
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    fireEvent.change(screen.getByDisplayValue("0900000000"), { target: { value: "0912345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(updateMine).toHaveBeenCalledWith({ phone_number: "0912345678" }));
    await waitFor(() => expect(getMine).toHaveBeenCalledTimes(2));
  });
});
