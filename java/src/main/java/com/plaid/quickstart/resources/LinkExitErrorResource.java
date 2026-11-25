package com.plaid.quickstart.resources;

import java.util.Map;
import javax.ws.rs.Consumes;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Path("/link_exit_error")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class LinkExitErrorResource {
  private static final Logger LOG = LoggerFactory.getLogger(LinkExitErrorResource.class);

  // Unauthenticated: log only short known fields, never the raw body
  @POST
  public Map<String, String> logLinkExitError(Map<String, Object> body) {
    if (body != null) {
      LOG.warn("Plaid Link exit error: code={} type={} institution={}",
          clip(body.get("error_code")), clip(body.get("error_type")), clip(body.get("institution_name")));
    }
    return Map.of("status", "logged");
  }

  private static String clip(Object v) {
    String s = String.valueOf(v).replaceAll("[\\r\\n]", " ");
    return s.length() > 80 ? s.substring(0, 80) : s;
  }
}
