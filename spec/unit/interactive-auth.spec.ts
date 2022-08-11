/*
Copyright 2016 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { MatrixClient } from "../../src/client";
import { logger } from "../../src/logger";
import { InteractiveAuth, AuthType } from "../../src/interactive-auth";
import { MatrixError } from "../../src/http-api";
import { sleep } from "../../src/utils";
import { randomString } from "../../src/randomstring";

// Trivial client object to test interactive auth
// (we do not need TestClient here)
class FakeClient {
    generateClientSecret() {
        return "testcl1Ent5EcreT";
    }
}

const getFakeClient = (): MatrixClient => new FakeClient() as unknown as MatrixClient;

describe("InteractiveAuth", () => {
    it("should start an auth stage and complete it", async () => {
        const doRequest = jest.fn();
        const stateUpdated = jest.fn();

        const ia = new InteractiveAuth({
            matrixClient: getFakeClient(),
            doRequest: doRequest,
            stateUpdated: stateUpdated,
            requestEmailToken: jest.fn(),
            authData: {
                session: "sessionId",
                flows: [
                    { stages: [AuthType.Password] },
                ],
                params: {
                    [AuthType.Password]: { param: "aa" },
                },
            },
        });

        expect(ia.getSessionId()).toEqual("sessionId");
        expect(ia.getStageParams(AuthType.Password)).toEqual({
            param: "aa",
        });

        // first we expect a call here
        stateUpdated.mockImplementation((stage) => {
            logger.log('aaaa');
            expect(stage).toEqual(AuthType.Password);
            ia.submitAuthDict({
                type: AuthType.Password,
            });
        });

        // .. which should trigger a call here
        const requestRes = { "a": "b" };
        doRequest.mockImplementation(async (authData) => {
            logger.log('cccc');
            expect(authData).toEqual({
                session: "sessionId",
                type: AuthType.Password,
            });
            return requestRes;
        });

        const res = await ia.attemptAuth();
        expect(res).toBe(requestRes);
        expect(doRequest).toBeCalledTimes(1);
        expect(stateUpdated).toBeCalledTimes(1);
    });

    it("should make a request if no authdata is provided", async () => {
        const doRequest = jest.fn();
        const stateUpdated = jest.fn();
        const requestEmailToken = jest.fn();

        const ia = new InteractiveAuth({
            matrixClient: getFakeClient(),
            stateUpdated,
            doRequest,
            requestEmailToken,
        });

        expect(ia.getSessionId()).toBe(undefined);
        expect(ia.getStageParams(AuthType.Password)).toBe(undefined);

        // first we expect a call to doRequest
        doRequest.mockImplementation((authData) => {
            logger.log("request1", authData);
            expect(authData).toEqual(null); // first request should be null
            const err = new MatrixError({
                session: "sessionId",
                flows: [
                    { stages: [AuthType.Password] },
                ],
                params: {
                    [AuthType.Password]: { param: "aa" },
                },
            });
            err.httpStatus = 401;
            throw err;
        });

        // .. which should be followed by a call to stateUpdated
        const requestRes = { "a": "b" };
        stateUpdated.mockImplementation((stage) => {
            expect(stage).toEqual(AuthType.Password);
            expect(ia.getSessionId()).toEqual("sessionId");
            expect(ia.getStageParams(AuthType.Password)).toEqual({
                param: "aa",
            });

            // submitAuthDict should trigger another call to doRequest
            doRequest.mockImplementation(async (authData) => {
                logger.log("request2", authData);
                expect(authData).toEqual({
                    session: "sessionId",
                    type: AuthType.Password,
                });
                return requestRes;
            });

            ia.submitAuthDict({
                type: AuthType.Password,
            });
        });

        const res = await ia.attemptAuth();
        expect(res).toBe(requestRes);
        expect(doRequest).toBeCalledTimes(2);
        expect(stateUpdated).toBeCalledTimes(1);
    });

    it("should make a request if authdata is null", async () => {
        const doRequest = jest.fn();
        const stateUpdated = jest.fn();
        const requestEmailToken = jest.fn();

        const ia = new InteractiveAuth({
            authData: null,
            matrixClient: getFakeClient(),
            stateUpdated,
            doRequest,
            requestEmailToken,
        });

        expect(ia.getSessionId()).toBe(undefined);
        expect(ia.getStageParams(AuthType.Password)).toBe(undefined);

        // first we expect a call to doRequest
        doRequest.mockImplementation((authData) => {
            logger.log("request1", authData);
            expect(authData).toEqual(null); // first request should be null
            const err = new MatrixError({
                session: "sessionId",
                flows: [
                    { stages: [AuthType.Password] },
                ],
                params: {
                    [AuthType.Password]: { param: "aa" },
                },
            });
            err.httpStatus = 401;
            throw err;
        });

        // .. which should be followed by a call to stateUpdated
        const requestRes = { "a": "b" };
        stateUpdated.mockImplementation((stage) => {
            expect(stage).toEqual(AuthType.Password);
            expect(ia.getSessionId()).toEqual("sessionId");
            expect(ia.getStageParams(AuthType.Password)).toEqual({
                param: "aa",
            });

            // submitAuthDict should trigger another call to doRequest
            doRequest.mockImplementation(async (authData) => {
                logger.log("request2", authData);
                expect(authData).toEqual({
                    session: "sessionId",
                    type: AuthType.Password,
                });
                return requestRes;
            });

            ia.submitAuthDict({
                type: AuthType.Password,
            });
        });

        const res = await ia.attemptAuth();
        expect(res).toBe(requestRes);
        expect(doRequest).toBeCalledTimes(2);
        expect(stateUpdated).toBeCalledTimes(1);
    });

    it("should start an auth stage and reject if no auth flow", async () => {
        const doRequest = jest.fn();
        const stateUpdated = jest.fn();
        const requestEmailToken = jest.fn();

        const ia = new InteractiveAuth({
            matrixClient: getFakeClient(),
            doRequest,
            stateUpdated,
            requestEmailToken,
        });

        doRequest.mockImplementation((authData) => {
            logger.log("request1", authData);
            expect(authData).toEqual(null); // first request should be null
            const err = new MatrixError({
                session: "sessionId",
                flows: [],
                params: {
                    [AuthType.Password]: { param: "aa" },
                },
            });
            err.httpStatus = 401;
            throw err;
        });

        await expect(ia.attemptAuth.bind(ia)).rejects.toThrow(
            new Error('No appropriate authentication flow found'),
        );
    });

    it("should start an auth stage and reject if no auth flow but has session", async () => {
        const doRequest = jest.fn();
        const stateUpdated = jest.fn();
        const requestEmailToken = jest.fn();

        const ia = new InteractiveAuth({
            matrixClient: getFakeClient(),
            doRequest,
            stateUpdated,
            requestEmailToken,
            authData: {
                session: "sessionId",
            },
        });

        doRequest.mockImplementation((authData) => {
            logger.log("request1", authData);
            expect(authData).toEqual({ "session": "sessionId" }); // has existing sessionId
            const err = new MatrixError({
                session: "sessionId",
                flows: [],
                params: {
                    [AuthType.Password]: { param: "aa" },
                },
            });
            err.httpStatus = 401;
            throw err;
        });

        await expect(ia.attemptAuth.bind(ia)).rejects.toThrow(
            new Error('No appropriate authentication flow found'),
        );
    });

    it("should allow dummy auth", async () => {
        const doRequest = jest.fn();
        const stateUpdated = jest.fn();
        const requestEmailToken = jest.fn();

        const ia = new InteractiveAuth({
            matrixClient: getFakeClient(),
            doRequest,
            stateUpdated,
            requestEmailToken,
            authData: {
                session: 'sessionId',
                flows: [
                    { stages: [AuthType.Dummy] },
                ],
                params: {},
            },
        });

        const requestRes = { "a": "b" };
        doRequest.mockImplementation((authData) => {
            logger.log("request1", authData);
            expect(authData).toEqual({
                session: "sessionId",
                type: AuthType.Dummy,
            });
            return requestRes;
        });

        const res = await ia.attemptAuth();
        expect(res).toBe(requestRes);
        expect(doRequest).toBeCalledTimes(1);
        expect(stateUpdated).toBeCalledTimes(0);
    });

    describe("requestEmailToken", () => {
        it("increases auth attempts", async () => {
            const doRequest = jest.fn();
            const stateUpdated = jest.fn();
            const requestEmailToken = jest.fn();
            requestEmailToken.mockImplementation(async () => ({ sid: "" }));

            const ia = new InteractiveAuth({
                matrixClient: getFakeClient(),
                doRequest, stateUpdated, requestEmailToken,
            });

            await ia.requestEmailToken();
            expect(requestEmailToken).toHaveBeenLastCalledWith(undefined, ia.getClientSecret(), 1, undefined);
            requestEmailToken.mockClear();
            await ia.requestEmailToken();
            expect(requestEmailToken).toHaveBeenLastCalledWith(undefined, ia.getClientSecret(), 2, undefined);
            requestEmailToken.mockClear();
            await ia.requestEmailToken();
            expect(requestEmailToken).toHaveBeenLastCalledWith(undefined, ia.getClientSecret(), 3, undefined);
            requestEmailToken.mockClear();
            await ia.requestEmailToken();
            expect(requestEmailToken).toHaveBeenLastCalledWith(undefined, ia.getClientSecret(), 4, undefined);
            requestEmailToken.mockClear();
            await ia.requestEmailToken();
            expect(requestEmailToken).toHaveBeenLastCalledWith(undefined, ia.getClientSecret(), 5, undefined);
        });

        it("increases auth attempts", async () => {
            const doRequest = jest.fn();
            const stateUpdated = jest.fn();
            const requestEmailToken = jest.fn();
            requestEmailToken.mockImplementation(async () => ({ sid: "" }));

            const ia = new InteractiveAuth({
                matrixClient: getFakeClient(),
                doRequest, stateUpdated, requestEmailToken,
            });

            await ia.requestEmailToken();
            expect(requestEmailToken).toHaveBeenLastCalledWith(undefined, ia.getClientSecret(), 1, undefined);
            requestEmailToken.mockClear();
            await ia.requestEmailToken();
            expect(requestEmailToken).toHaveBeenLastCalledWith(undefined, ia.getClientSecret(), 2, undefined);
            requestEmailToken.mockClear();
            await ia.requestEmailToken();
            expect(requestEmailToken).toHaveBeenLastCalledWith(undefined, ia.getClientSecret(), 3, undefined);
            requestEmailToken.mockClear();
            await ia.requestEmailToken();
            expect(requestEmailToken).toHaveBeenLastCalledWith(undefined, ia.getClientSecret(), 4, undefined);
            requestEmailToken.mockClear();
            await ia.requestEmailToken();
            expect(requestEmailToken).toHaveBeenLastCalledWith(undefined, ia.getClientSecret(), 5, undefined);
        });

        it("passes errors through", async () => {
            const doRequest = jest.fn();
            const stateUpdated = jest.fn();
            const requestEmailToken = jest.fn();
            requestEmailToken.mockImplementation(async () => {
                throw new Error("unspecific network error");
            });

            const ia = new InteractiveAuth({
                matrixClient: getFakeClient(),
                doRequest, stateUpdated, requestEmailToken,
            });

            await expect(ia.requestEmailToken.bind(ia)).rejects.toThrowError("unspecific network error");
        });

        it("only starts one request at a time", async () => {
            const doRequest = jest.fn();
            const stateUpdated = jest.fn();
            const requestEmailToken = jest.fn();
            requestEmailToken.mockImplementation(() => sleep(500, { sid: "" }));

            const ia = new InteractiveAuth({
                matrixClient: getFakeClient(),
                doRequest, stateUpdated, requestEmailToken,
            });

            await Promise.all([ia.requestEmailToken(), ia.requestEmailToken(), ia.requestEmailToken()]);
            expect(requestEmailToken).toHaveBeenCalledTimes(1);
        });

        it("stores result in email sid", async () => {
            const doRequest = jest.fn();
            const stateUpdated = jest.fn();
            const requestEmailToken = jest.fn();
            const sid = randomString(24);
            requestEmailToken.mockImplementation(() => sleep(500, { sid }));

            const ia = new InteractiveAuth({
                matrixClient: getFakeClient(),
                doRequest, stateUpdated, requestEmailToken,
            });

            await ia.requestEmailToken();
            expect(ia.getEmailSid()).toEqual(sid);
        });
    });
});
