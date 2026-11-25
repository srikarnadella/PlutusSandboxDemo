package com.plaid.quickstart;

import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.ext.ExceptionMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class PlaidApiExceptionMapper implements ExceptionMapper<PlaidApiException> {
    private static final Logger LOG = LoggerFactory.getLogger(PlaidApiExceptionMapper.class);

    @Override
    public Response toResponse(PlaidApiException exception) {
        LOG.warn("Plaid error: {}", exception.getErrorResponse());
        int statusCode = exception.getStatusCode();
        return Response.status(statusCode)
            .entity(exception.getErrorResponse())
            .type(MediaType.APPLICATION_JSON)
            .build();
    }
}
