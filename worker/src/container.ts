import { Container } from "@cloudflare/containers";

export class ValidatorContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "5m";
}
