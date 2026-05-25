import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function created<T>(data: T) {
  return ok(data, 201);
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function handleError(error: unknown) {
  console.error("[MB_TECH_API_ERROR]", error);

  if (error instanceof ZodError) {
    return fail("Dados inválidos.", 422, error.flatten());
  }

  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") return fail("Sessão inválida ou expirada.", 401);
    if (error.message === "FORBIDDEN") return fail("Você não tem permissão para acessar este recurso.", 403);
    if (error.message === "NOT_FOUND") return fail("Registro não encontrado.", 404);
    return fail(error.message || "Erro interno do servidor.", 500);
  }

  return fail("Erro interno do servidor.", 500);
}

export function parseSearchParams(req: Request) {
  return new URL(req.url).searchParams;
}
