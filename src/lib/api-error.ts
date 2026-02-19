export type ApiErrorDetail = {
  path: string;
  message: string;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
};

export const jsonError = (
  status: number,
  code: string,
  message: string,
  details?: ApiErrorDetail[],
  headers?: HeadersInit
): Response => {
  const body: ApiError = {
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {})
    }
  };

  return Response.json(body, { status, headers });
};
