# Multi-stage build: compile with the full Go toolchain, ship a minimal
# runtime image. Migrations are embedded into the binary (see
# migrations/embed.go), so no migration files need to be copied separately.

FROM golang:1.26 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/api ./cmd/api

FROM gcr.io/distroless/static-debian12
COPY --from=build /out/api /api
EXPOSE 8080
ENTRYPOINT ["/api"]
