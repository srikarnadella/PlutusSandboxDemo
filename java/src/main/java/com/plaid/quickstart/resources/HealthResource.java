package com.plaid.quickstart.resources;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import java.util.Map;

@Path("/health")
@Produces(MediaType.APPLICATION_JSON)
public class HealthResource {
  @GET
  public Map<String, String> health() {
    return Map.of("status", "ok");
  }
}
