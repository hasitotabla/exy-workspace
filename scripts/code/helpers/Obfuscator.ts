import axios from "axios";

export const obfuscator = (() => {
    const createSession = async (source: string): Promise<string | null> => {
        try {
            const response = await axios("https://api.luaobfuscator.com/v1/obfuscator/newscript", {
                method: "POST",
                data: source,
                headers: {
                    "Content-Type": "application/json",
                    apikey: process.env.OBFUSCATOR_API_KEY,
                },
            });

            if (response.status !== 200) {
                throw new Error(`Failed to create session: ${response.statusText}`);
            }

            if (!response?.data?.sessionId) {
                throw new Error(`Failed to create session: ${response.data}`);
            }

            return response.data.sessionId;
        } catch (error: any) {
            console.error(`Failed to create session`, error?.response?.data);
            return null;
        }
    };

    const startObfuscation = async (sessionId: string): Promise<string | null> => {
        try {
            const response = await axios("https://api.luaobfuscator.com/v1/obfuscator/obfuscate", {
                method: "POST",
                data: { MinifyAll: true, Virtualize: true },
                headers: {
                    "Content-Type": "application/json",
                    apikey: process.env.OBFUSCATOR_API_KEY,
                    sessionId: sessionId,
                },
            });

            if (response.status !== 200) {
                throw new Error(`Failed to start obfuscation: ${response.statusText}`);
            }

            if (!response?.data?.code) {
                throw new Error(`Failed to start obfuscation: ${response.data}`);
            }

            return response.data.code;
        } catch (error: any) {
            console.error(`Failed to start obfuscation`, error?.response);
            return null;
        }
    };

    return {
        obfuscate: async (source: string): Promise<string | null> => {
            throw new Error(`Obfuscation is disabled`);

            //   const session = await createSession(source);
            //   if (!session) {
            //     return null;
            //   }

            //   const obfuscated = await startObfuscation(session);
            //   if (!obfuscated) {
            //     return null;
            //   }

            //   return obfuscated;
        },
    };
})();
