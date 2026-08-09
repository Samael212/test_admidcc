require("dotenv").config();

const express =
    require("express");

const session =
    require("express-session");

const fs =
    require("fs");

const path =
    require("path");


const app =
    express();


const PORT =
    Number(
        process.env.PORT ||
        3000
    );


const DATA_DIR =
    path.join(
        __dirname,
        "data"
    );


const DATA_FILE =
    path.join(
        DATA_DIR,
        "records.json"
    );


fs.mkdirSync(
    DATA_DIR,
    {
        recursive:
            true
    }
);


if (
    !fs.existsSync(
        DATA_FILE
    )
) {

    fs.writeFileSync(
        DATA_FILE,
        "[]",
        "utf8"
    );

}


app.use(
    express.json()
);


app.use(
    express.urlencoded({
        extended:
            true
    })
);


app.use(

    session({

        secret:
            process.env.SESSION_SECRET ||
            "CHANGE_ME",

        resave:
            false,

        saveUninitialized:
            false,

        cookie: {

            httpOnly:
                true,

            sameSite:
                "lax",

            secure:
                process.env.NODE_ENV ===
                "production",

            maxAge:
                1000 *
                60 *
                60 *
                8

        }

    })

);


// ==========================
// DATA
// ==========================

function getRecords() {

    try {

        return JSON.parse(

            fs.readFileSync(
                DATA_FILE,
                "utf8"
            )

        );

    } catch {

        return [];

    }

}


function saveRecords(
    records
) {

    fs.writeFileSync(

        DATA_FILE,

        JSON.stringify(
            records,
            null,
            2
        ),

        "utf8"

    );

}


// ==========================
// ADMIN
// ==========================

function getAdminIds() {

    return String(
        process.env.ADMIN_IDS ||
        ""
    )

        .split(",")

        .map(
            id =>
                id.trim()
        )

        .filter(Boolean);

}


function isAdmin(req) {

    return (

        !!req.session.user &&

        getAdminIds()
            .includes(
                req.session.user.id
            )

    );

}


function requireAdmin(
    req,
    res,
    next
) {

    if (
        !isAdmin(req)
    ) {

        return res
            .status(403)
            .json({

                ok:
                    false,

                message:
                    "คุณไม่มีสิทธิ์ ADMIN"

            });

    }


    next();

}


// ==========================
// DISCORD LOG
// ==========================

async function sendDiscordLog({

    title,

    description,

    color =
        0xD4AF37,

    fields =
        []

}) {

    const webhook =
        process.env
            .DISCORD_WEBHOOK_URL;


    if (
        !webhook
    ) {
        return;
    }


    try {

        const response =
            await fetch(

                webhook,

                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            username:
                                "MAVERICK BLACK",

                            embeds: [

                                {

                                    title,

                                    description,

                                    color,

                                    fields,

                                    footer: {

                                        text:
                                            "MAVERICK BLACK • DUTY SYSTEM"

                                    },

                                    timestamp:
                                        new Date()
                                            .toISOString()

                                }

                            ]

                        })

                }

            );


        if (
            !response.ok
        ) {

            console.error(

                "Discord Webhook:",

                await response.text()

            );

        }

    } catch (
        error
    ) {

        console.error(

            "Discord Webhook Error:",

            error.message

        );

    }

}


// ==========================
// CURRENT USER
// ==========================

app.get(

    "/api/me",

    (req, res) => {

        if (
            !req.session.user
        ) {

            return res.json({

                loggedIn:
                    false,

                admin:
                    false

            });

        }


        res.json({

            loggedIn:
                true,

            admin:
                isAdmin(req),

            user: {

                id:
                    req.session.user.id,

                username:
                    req.session.user.username,

                global_name:
                    req.session.user.global_name,

                avatar:
                    req.session.user.avatar

            }

        });

    }

);


// ==========================
// RECORDS
// ==========================

app.get(

    "/api/records",

    (req, res) => {

        res.json(
            getRecords()
        );

    }

);


// ==========================
// CHECK IN
// ==========================

app.post(

    "/api/check-in",

    async (
        req,
        res
    ) => {

        const name =
            String(
                req.body.name ||
                ""
            ).trim();


        if (
            !name
        ) {

            return res
                .status(400)
                .json({

                    ok:
                        false,

                    message:
                        "กรุณากรอกชื่อ"

                });

        }


        const records =
            getRecords();


        const active =
            records.find(

                record =>

                    record.name ===
                    name &&

                    record.status ===
                    "active"

            );


        if (
            active
        ) {

            return res
                .status(409)
                .json({

                    ok:
                        false,

                    message:
                        "ชื่อนี้กำลังเข้าเวรอยู่แล้ว"

                });

        }


        const now =
            new Date();


        const record = {

            id:
                `${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2, 8)}`,

            name,

            date:
                now.toLocaleDateString(
                    "th-TH"
                ),

            checkIn:
                now.toLocaleTimeString(
                    "th-TH"
                ),

            checkOut:
                "-",

            status:
                "active"

        };


        records.unshift(
            record
        );


        saveRecords(
            records
        );


        await sendDiscordLog({

            title:
                "🟢 เข้าเวร",

            description:
                "มีผู้ปฏิบัติงานทำรายการ **เข้าเวร**",

            color:
                0x22C55E,

            fields: [

                {

                    name:
                        "👤 ชื่อ",

                    value:
                        `\`${name}\``,

                    inline:
                        true

                },

                {

                    name:
                        "📅 วันที่",

                    value:
                        `\`${record.date}\``,

                    inline:
                        true

                },

                {

                    name:
                        "🕐 เวลาเข้า",

                    value:
                        `\`${record.checkIn}\``,

                    inline:
                        true

                }

            ]

        });


        res.json({

            ok:
                true,

            record

        });

    }

);


// ==========================
// CHECK OUT
// ==========================

app.post(

    "/api/check-out",

    async (
        req,
        res
    ) => {

        const name =
            String(
                req.body.name ||
                ""
            ).trim();


        if (
            !name
        ) {

            return res
                .status(400)
                .json({

                    ok:
                        false,

                    message:
                        "กรุณากรอกชื่อ"

                });

        }


        const records =
            getRecords();


        const record =
            records.find(

                record =>

                    record.name ===
                    name &&

                    record.status ===
                    "active"

            );


        if (
            !record
        ) {

            return res
                .status(404)
                .json({

                    ok:
                        false,

                    message:
                        "ไม่พบข้อมูลการเข้าเวร"

                });

        }


        record.checkOut =
            new Date()
                .toLocaleTimeString(
                    "th-TH"
                );


        record.status =
            "finished";


        saveRecords(
            records
        );


        await sendDiscordLog({

            title:
                "🔴 ออกเวร",

            description:
                "มีผู้ปฏิบัติงานทำรายการ **ออกเวร**",

            color:
                0xEF4444,

            fields: [

                {

                    name:
                        "👤 ชื่อ",

                    value:
                        `\`${name}\``,

                    inline:
                        true

                },

                {

                    name:
                        "🕐 เวลาเข้า",

                    value:
                        `\`${record.checkIn}\``,

                    inline:
                        true

                },

                {

                    name:
                        "🕐 เวลาออก",

                    value:
                        `\`${record.checkOut}\``,

                    inline:
                        true

                }

            ]

        });


        res.json({

            ok:
                true,

            record

        });

    }

);


// ==========================
// DELETE ONE
// ==========================

app.delete(

    "/api/records/:id",

    requireAdmin,

    async (
        req,
        res
    ) => {

        const records =
            getRecords();


        const index =
            records.findIndex(

                record =>
                    record.id ===
                    req.params.id

            );


        if (
            index === -1
        ) {

            return res
                .status(404)
                .json({

                    ok:
                        false,

                    message:
                        "ไม่พบรายการ"

                });

        }


        const deleted =
            records.splice(
                index,
                1
            )[0];


        saveRecords(
            records
        );


        const adminName =
            req.session.user.global_name ||
            req.session.user.username;


        await sendDiscordLog({

            title:
                "🗑️ ADMIN ลบรายการ",

            description:
                "ADMIN ได้ลบประวัติการเข้าเวร",

            color:
                0xF97316,

            fields: [

                {

                    name:
                        "👤 รายการ",

                    value:
                        `\`${deleted.name}\``,

                    inline:
                        true

                },

                {

                    name:
                        "👑 ADMIN",

                    value:
                        `\`${adminName}\``,

                    inline:
                        true

                }

            ]

        });


        res.json({
            ok:
                true
        });

    }

);


// ==========================
// CLEAR ALL
// ==========================

app.delete(

    "/api/records",

    requireAdmin,

    async (
        req,
        res
    ) => {

        const password =
            String(
                req.body.password ||
                ""
            );


        if (

            !process.env
                .ADMIN_DELETE_PASSWORD ||

            password !==
                process.env
                    .ADMIN_DELETE_PASSWORD

        ) {

            return res
                .status(401)
                .json({

                    ok:
                        false,

                    message:
                        "รหัสล้างประวัติไม่ถูกต้อง"

                });

        }


        const records =
            getRecords();


        const totalDeleted =
            records.length;


        saveRecords([]);


        const adminName =
            req.session.user.global_name ||
            req.session.user.username;


        await sendDiscordLog({

            title:
                "🧹 ADMIN ล้างประวัติ",

            description:
                "ADMIN ได้ล้างประวัติทั้งหมด",

            color:
                0xDC2626,

            fields: [

                {

                    name:
                        "👑 ADMIN",

                    value:
                        `\`${adminName}\``,

                    inline:
                        true

                },

                {

                    name:
                        "📋 จำนวน",

                    value:
                        `\`${totalDeleted}\` รายการ`,

                    inline:
                        true

                }

            ]

        });


        res.json({
            ok:
                true
        });

    }

);


// ==========================
// DISCORD LOGIN
// ==========================

app.get(

    "/auth/discord",

    (req, res) => {

        const params =
            new URLSearchParams({

                client_id:
                    process.env
                        .DISCORD_CLIENT_ID,

                redirect_uri:
                    process.env
                        .DISCORD_REDIRECT_URI,

                response_type:
                    "code",

                scope:
                    "identify"

            });


        res.redirect(

            "https://discord.com/oauth2/authorize?" +

            params.toString()

        );

    }

);


// ==========================
// DISCORD CALLBACK
// ==========================

app.get(

    "/auth/discord/callback",

    async (
        req,
        res
    ) => {

        try {

            const code =
                req.query.code;


            if (
                !code
            ) {

                return res
                    .status(400)
                    .send(
                        "ไม่พบ Discord OAuth Code"
                    );

            }


            const tokenResponse =
                await fetch(

                    "https://discord.com/api/oauth2/token",

                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/x-www-form-urlencoded"

                        },

                        body:
                            new URLSearchParams({

                                client_id:
                                    process.env
                                        .DISCORD_CLIENT_ID,

                                client_secret:
                                    process.env
                                        .DISCORD_CLIENT_SECRET,

                                grant_type:
                                    "authorization_code",

                                code,

                                redirect_uri:
                                    process.env
                                        .DISCORD_REDIRECT_URI

                            })

                    }

                );


            const token =
                await tokenResponse
                    .json();


            if (
                !token.access_token
            ) {

                console.error(
                    token
                );


                return res
                    .status(401)
                    .send(
                        "Discord Login ไม่สำเร็จ"
                    );

            }


            const userResponse =
                await fetch(

                    "https://discord.com/api/users/@me",

                    {

                        headers: {

                            Authorization:
                                `Bearer ${token.access_token}`

                        }

                    }

                );


            const user =
                await userResponse
                    .json();


            req.session.user =
                user;


            await sendDiscordLog({

                title:
                    "🔵 Discord Login",

                description:
                    "มีผู้ใช้งานเข้าสู่ระบบ",

                color:
                    0x5865F2,

                fields: [

                    {

                        name:
                            "👤 Discord",

                        value:
                            `\`${user.global_name || user.username}\``,

                        inline:
                            true

                    },

                    {

                        name:
                            "👑 สิทธิ์",

                        value:

                            getAdminIds()
                                .includes(
                                    user.id
                                )

                                ?

                                "ADMIN"

                                :

                                "USER",

                        inline:
                            true

                    }

                ]

            });


            res.redirect("/");

        } catch (
            error
        ) {

            console.error(
                error
            );


            res
                .status(500)
                .send(
                    "Discord OAuth Error"
                );

        }

    }

);


// ==========================
// LOGOUT
// ==========================

app.post(

    "/auth/logout",

    async (
        req,
        res
    ) => {

        const user =
            req.session.user;


        if (
            user
        ) {

            await sendDiscordLog({

                title:
                    "🚪 Discord Logout",

                description:
                    "ผู้ใช้งานออกจากระบบ",

                color:
                    0x64748B,

                fields: [

                    {

                        name:
                            "👤 ผู้ใช้",

                        value:
                            `\`${user.global_name || user.username}\``,

                        inline:
                            true

                    }

                ]

            });

        }


        req.session.destroy(

            () => {

                res.json({
                    ok:
                        true
                });

            }

        );

    }

);


// ==========================
// STATIC
// ==========================

app.use(
    express.static(
        __dirname
    )
);


// ==========================
// HOME
// ==========================

app.get(
    "/",
    (
        req,
        res
    ) => {

        res.sendFile(

            path.join(
                __dirname,
                "index.html"
            )

        );

    }
);


// ==========================
// START
// ==========================

app.listen(

    PORT,

    () => {

        console.log(
            "======================================"
        );

        console.log(
            "MAVERICK BLACK DUTY SYSTEM"
        );

        console.log(
            `Website: http://localhost:${PORT}`
        );

        console.log(
            `Discord Login: http://localhost:${PORT}/auth/discord`
        );

        console.log(
            "======================================"
        );

    }

);