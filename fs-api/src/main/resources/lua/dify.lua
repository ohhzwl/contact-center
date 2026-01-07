-- ===================== 环境依赖 =====================
-- luarocks install luasocket luasec ltn12 dkjson lfs basexx

local socket = require("socket.http")
local https = require("ssl.https")
local ltn12 = require("ltn12")
local dkjson = require("dkjson")
local lfs = require("lfs")
local basexx = require("basexx")
local io = require("io")
local os = require("os")

-- ===================== 极简配置 =====================
local config = {
    dify_api_version = "v1",
    dify_base_url = "http://121.43.122.41:180",
    asr = { api_key = "app-ZRBnzeQ0j32dESy3A89M0qMV", workflow_id = "xS2uaYQW4MQeLVYC", retry_times = 1 },
    tts = { api_key = "app-0SXzFGbR8GR8ezrg5WTQ7NIj", workflow_id = "uwm0LXSdABRA67mL", retry_times = 1 },
    nlp = { api_key = "app-rqbwIN5nSrbsLSkCp3HSQPPe", chatflow_id = "ifOeClexyjNsw1kp", retry_times = 1 },
    max_dialog_rounds = 8,
    temp_audio_path = "/tmp/fs_ivr_audio/",
    org = "5000",
    ivr_timeout = 8,
    ivr_retry_times = 2,
    download_timeout = 10000
}

-- ===================== 仅输出到session控制台的日志函数 =====================
local function consoleLog(session, level, msg)
    local timestamp = os.date("%Y-%m-%d %H:%M:%S")
    local log_msg = string.format("[%s] [%s] %s\n", timestamp, level, msg)
    -- 仅输出到session控制台，无其他冗余逻辑
    session:consoleLog(level, log_msg)
end

-- ===================== 基础工具函数（极简版） =====================
local function create_temp_dir(session)
    if lfs.attributes(config.temp_audio_path, "mode") ~= "directory" then
        os.execute("mkdir -p " .. config.temp_audio_path)
        consoleLog(session, "INFO", "创建临时目录：" .. config.temp_audio_path)
    end
end

local function get_dify_headers(api_key)
    return {
        ["Content-Type"] = "application/json",
        ["Authorization"] = "Bearer " .. api_key
    }
end

local function base64_encode(data, session)
    local ok, res = pcall(basexx.to_base64, data)
    if not ok then
        consoleLog(session, "ERR", "Base64 编码失败：" .. res)
        return nil
    end
    return res
end

-- ===================== 核心HTTP请求（极简版） =====================
local function http_request_with_retry(session, method, url, headers, post_data, retry_times)
    local retry = 0
    local result = nil
    local http_client = string.match(url, "^https://") and https or socket

    while retry <= retry_times do
        local response_body = {}
        local request_opts = {
            url = url, method = method, headers = headers or {},
            sink = ltn12.sink.table(response_body), timeout = 10
        }

        if post_data and (method == "POST" or method == "PUT") then
            local post_json = dkjson.encode(post_data, {indent = false})
            request_opts.headers["Content-Length"] = #post_json
            request_opts.source = ltn12.source.string(post_json)
        end

        local pcall_result = {pcall(http_client.request, request_opts)}
        local ok = pcall_result[1]
        local status_code = ok and pcall_result[3] or nil
        local resp_str = table.concat(response_body)
        local resp_json = resp_str ~= "" and pcall(dkjson.decode, resp_str) and select(2, pcall(dkjson.decode, resp_str)) or nil

        if ok and tonumber(status_code) == 200 and resp_json then
            result = resp_json
            consoleLog(session, "INFO", "HTTP请求成功（重试"..retry.."）：状态码="..status_code)
            break
        else
            consoleLog(session, "ERR", "HTTP请求失败（重试"..retry.."）："..tostring(pcall_result[3]).." | 响应："..resp_str)
            retry = retry + 1
            socket.sleep(0.5)
        end
    end
    return result
end

-- ===================== 音频处理（极简版） =====================
local function audio_to_base64(session, audio_file_path)
    local file, err = io.open(audio_file_path, "rb")
    if not file then
        consoleLog(session, "ERR", "无法打开音频文件：" .. audio_file_path .. " | " .. err)
        return nil
    end
    local audio_data = file:read("*a")
    file:close()
    return base64_encode(audio_data, session)
end

local function download_oss_audio(session, audio_url, save_path)
    if not audio_url then
        consoleLog(session, "ERR", "音频URL为空")
        return nil
    end

    local http_client = string.match(audio_url, "^https://") and https or socket
    local response_body = {}
    local request_opts = {
        url = audio_url, method = "GET", sink = ltn12.sink.table(response_body),
        timeout = config.download_timeout / 1000
    }

    local pcall_result = {pcall(http_client.request, request_opts)}
    if not pcall_result[1] or tonumber(pcall_result[3]) ~= 200 then
        consoleLog(session, "ERR", "OSS音频下载失败："..audio_url.." | 状态码="..tostring(pcall_result[3]))
        return nil
    end

    local dir = save_path:match("^(.*[/\\])")
    if dir then os.execute("mkdir -p " .. dir) end
    local file = io.open(save_path, "wb")
    if file then
        file:write(table.concat(response_body))
        file:close()
        consoleLog(session, "INFO", "音频下载成功：" .. save_path)
        return save_path
    end
    return nil
end

-- ===================== Dify调用（极简版，session显式传入） =====================
local function call_dify_asr(session, audio_file, org, uuid,file_name)
    consoleLog(session, "INFO", "调用ASR：" .. audio_file)
    local audio_base64 = audio_to_base64(session, audio_file)
    if not audio_base64 then
        session:execute("say", "zh read cardinal 无法识别语音")
        return nil
    end

    local result = http_request_with_retry(session, "POST",
            config.dify_base_url.."/"..config.dify_api_version.."/workflows/run",
            get_dify_headers(config.asr.api_key),
            {
                workflow_id = config.asr.workflow_id,
                inputs = { audio = audio_base64, org = org, uuid = uuid,file_name = file_name },
                conversation_id = uuid, user = "fs_ivr_"..uuid, response_mode = "blocking"
            },
            config.asr.retry_times
    )

    local text = result and (result.data and result.data.outputs.text or result.outputs.text) or ""
    if text ~= "" then
        consoleLog(session, "INFO", "ASR识别结果：" .. text)
        return text
    else
        consoleLog(session, "ERR", "ASR无结果：" .. dkjson.encode(result))
        session:execute("say", "zh read cardinal 未识别到语音")
        return nil
    end
end

local function call_dify_tts(session, text, org, uuid)
    if not text then
        session:execute("say", "zh read cardinal 无回复内容")
        return nil
    end
    consoleLog(session, "INFO", "调用TTS：" .. text)

    local result = http_request_with_retry(session, "POST",
            config.dify_base_url.."/"..config.dify_api_version.."/workflows/run",
            get_dify_headers(config.tts.api_key),
            {
                workflow_id = config.tts.workflow_id,
                inputs = { text = text, org = org, uuid = uuid },
                conversation_id = uuid, user = "fs_ivr_"..uuid, response_mode = "blocking"
            },
            config.tts.retry_times
    )

    local audio_url = result and (result.data and result.data.outputs.audio_url or result.outputs.audio_url) or ""
    if audio_url ~= "" then
        consoleLog(session, "INFO", "TTS音频URL：" .. audio_url)

        local audio_path = config.temp_audio_path .. "tts_" .. uuid .. ".wav"
        if download_oss_audio(session, audio_url, audio_path) then
            session:execute("playback", audio_path)
            os.remove(audio_path)
        end
        return audio_url
    else
        consoleLog(session, "ERR", "TTS无音频：" .. dkjson.encode(result))
        session:execute("say", "zh read cardinal " .. text)
        return nil
    end
end

local function call_dify_nlp(session, text, org, uuid, conv_id)
    if not text then
        local default = "没听清你的问题，请再说一遍"
        session:execute("say", "zh read cardinal " .. default)
        return default
    end
    consoleLog(session, "INFO", "调用NLP：" .. text)

    local post_data = {
        chatflow_id = config.nlp.chatflow_id,
        query = text, user = "fs_ivr_"..uuid, response_mode = "blocking",inputs = {}
    }
    if conv_id then post_data.conversation_id = conv_id end

    local result = http_request_with_retry(session, "POST",
            config.dify_base_url.."/"..config.dify_api_version.."/chat-messages",
            get_dify_headers(config.nlp.api_key),
            post_data,
            config.nlp.retry_times
    )

    local reply = result and result.answer or "系统暂时无法回复"
    consoleLog(session, "INFO", "NLP回复：" .. reply)
    call_dify_tts(session, reply, org, uuid)
    return { reply = reply, conv_id = result and result.conversation_id or conv_id }
end

-- ===================== IVR主流程（session作为参数传入） =====================
local function ivr_main(session)
    session:answer()
    session:execute("set", "autohangup=false")
    local uuid = session:getVariable("uuid") or "fs_ivr_" .. os.time()
    local conv_id = nil

    create_temp_dir(session)
    consoleLog(session, "INFO", "===== IVR会话启动：" .. uuid .. " =====")

    -- 欢迎语
    call_dify_tts(session, "欢迎使用智能客服", config.org, uuid)

    -- 多轮对话
    local dialog_round = 0
    local retry = 0
    while dialog_round < config.max_dialog_rounds do
        dialog_round = dialog_round + 1
        consoleLog(session, "INFO", "===== 对话轮数：" .. dialog_round .. " =====")

        -- 录音
        local file_name = "record_" .. uuid .. "_" .. dialog_round .. ".wav"
        local record_file = config.temp_audio_path .. file_name
        consoleLog(session, "INFO", "开始录音（超时"..config.ivr_timeout.."秒）")
        local record_result = session:execute("record", record_file .. " " .. config.ivr_timeout .. " silence://2 8000")
        consoleLog(session, "DEBUG", "录音执行结果：" .. tostring(record_result))
        session:sleep(500)
        -- 检查录音文件
        if not io.open(record_file, "rb") then
            consoleLog(session, "WARN", "录音文件不存在，重试")
            retry = retry + 1
            if retry >= config.ivr_retry_times then
                session:execute("say", "zh read cardinal 多次未检测到语音，对话结束")
                break
            else
                session:execute("say", "zh read cardinal 没有听清，请再说一遍")
                goto continue
            end
        end
        retry = 0

        -- ASR -> NLP -> TTS
        local user_text = call_dify_asr(session, record_file, config.org, uuid,file_name)
        os.remove(record_file)
        if user_text then
            local nlp_res = call_dify_nlp(session, user_text, config.org, uuid, conv_id)
            conv_id = nlp_res.conv_id

            -- 结束意图检测
            if string.find(nlp_res.reply, "再见") or string.find(nlp_res.reply, "结束") then
                call_dify_tts(session, "感谢咨询，再见！", config.org, uuid)
                break
            end
        end

        ::continue::
    end

    consoleLog(session, "INFO", "===== IVR会话结束：" .. uuid .. " =====")
    session:execute("hangup")
end

-- ===================== 入口函数（仅接收session参数） =====================
local function main(session)
    session:execute("set", "autohangup=0") -- 彻底禁止自动挂断
    session:execute("set", "session_timeout=60")
    session:execute("set", "hangup_after_bridge=0")
    session:execute("set", "continue_on_fail=1") -- 失败后继续执行
    -- 强制激活媒体通道（解决playback requires media问题）
    -- session:execute("set", "media_must_be_answered=true")
    -- session:execute("set", "rtp_autofix=true")
    -- 启用媒体流
    -- session:execute("media", "reset")
    -- session:execute("media", "active")
    local ok, err = pcall(ivr_main, session)
    if not ok then
        consoleLog(session, "ERR", "IVR执行异常：" .. err)
        session:answer()
        session:execute("say", "zh read cardinal 系统异常，请稍后再试")
        session:execute("hangup")
    end
end

-- 启动（FS中调用时会自动传入session参数）
main(session)
-- ===================== 环境依赖 =====================
-- luarocks install luasocket luasec ltn12 dkjson lfs basexx

local socket = require("socket.http")
local https = require("ssl.https")
local ltn12 = require("ltn12")
local dkjson = require("dkjson")
local lfs = require("lfs")
local basexx = require("basexx")
local io = require("io")
local os = require("os")

-- ===================== 极简配置 =====================
local config = {
    dify_api_version = "v1",
    dify_base_url = "http://121.43.122.41:180",
    asr = { api_key = "app-ZRBnzeQ0j32dESy3A89M0qMV", workflow_id = "xS2uaYQW4MQeLVYC", retry_times = 1 },
    tts = { api_key = "app-0SXzFGbR8GR8ezrg5WTQ7NIj", workflow_id = "uwm0LXSdABRA67mL", retry_times = 1 },
    nlp = { api_key = "app-rqbwIN5nSrbsLSkCp3HSQPPe", chatflow_id = "ifOeClexyjNsw1kp", retry_times = 1 },
    max_dialog_rounds = 8,
    temp_audio_path = "/tmp/fs_ivr_audio/",
    org = "5000",
    ivr_timeout = 8,
    ivr_retry_times = 2,
    download_timeout = 10000
}

-- ===================== 仅输出到session控制台的日志函数 =====================
local function consoleLog(session, level, msg)
    local timestamp = os.date("%Y-%m-%d %H:%M:%S")
    local log_msg = string.format("[%s] [%s] %s\n", timestamp, level, msg)
    -- 仅输出到session控制台，无其他冗余逻辑
    session:consoleLog(level, log_msg)
end

-- ===================== 基础工具函数（极简版） =====================
local function create_temp_dir(session)
    if lfs.attributes(config.temp_audio_path, "mode") ~= "directory" then
        os.execute("mkdir -p " .. config.temp_audio_path)
        consoleLog(session, "INFO", "创建临时目录：" .. config.temp_audio_path)
    end
end

local function get_dify_headers(api_key)
    return {
        ["Content-Type"] = "application/json",
        ["Authorization"] = "Bearer " .. api_key
    }
end

local function base64_encode(data, session)
    local ok, res = pcall(basexx.to_base64, data)
    if not ok then
        consoleLog(session, "ERR", "Base64 编码失败：" .. res)
        return nil
    end
    return res
end

-- ===================== 核心HTTP请求（极简版） =====================
local function http_request_with_retry(session, method, url, headers, post_data, retry_times)
    local retry = 0
    local result = nil
    local http_client = string.match(url, "^https://") and https or socket

    while retry <= retry_times do
        local response_body = {}
        local request_opts = {
            url = url, method = method, headers = headers or {},
            sink = ltn12.sink.table(response_body), timeout = 10
        }

        if post_data and (method == "POST" or method == "PUT") then
            local post_json = dkjson.encode(post_data, {indent = false})
            request_opts.headers["Content-Length"] = #post_json
            request_opts.source = ltn12.source.string(post_json)
        end

        local pcall_result = {pcall(http_client.request, request_opts)}
        local ok = pcall_result[1]
        local status_code = ok and pcall_result[3] or nil
        local resp_str = table.concat(response_body)
        local resp_json = resp_str ~= "" and pcall(dkjson.decode, resp_str) and select(2, pcall(dkjson.decode, resp_str)) or nil

        if ok and tonumber(status_code) == 200 and resp_json then
            result = resp_json
            consoleLog(session, "INFO", "HTTP请求成功（重试"..retry.."）：状态码="..status_code)
            break
        else
            consoleLog(session, "ERR", "HTTP请求失败（重试"..retry.."）："..tostring(pcall_result[3]).." | 响应："..resp_str)
            retry = retry + 1
            socket.sleep(0.5)
        end
    end
    return result
end

-- ===================== 音频处理（极简版） =====================
local function audio_to_base64(session, audio_file_path)
    local file, err = io.open(audio_file_path, "rb")
    if not file then
        consoleLog(session, "ERR", "无法打开音频文件：" .. audio_file_path .. " | " .. err)
        return nil
    end
    local audio_data = file:read("*a")
    file:close()
    return base64_encode(audio_data, session)
end

local function download_oss_audio(session, audio_url, save_path)
    if not audio_url then
        consoleLog(session, "ERR", "音频URL为空")
        return nil
    end

    local http_client = string.match(audio_url, "^https://") and https or socket
    local response_body = {}
    local request_opts = {
        url = audio_url, method = "GET", sink = ltn12.sink.table(response_body),
        timeout = config.download_timeout / 1000
    }

    local pcall_result = {pcall(http_client.request, request_opts)}
    if not pcall_result[1] or tonumber(pcall_result[3]) ~= 200 then
        consoleLog(session, "ERR", "OSS音频下载失败："..audio_url.." | 状态码="..tostring(pcall_result[3]))
        return nil
    end

    local dir = save_path:match("^(.*[/\\])")
    if dir then os.execute("mkdir -p " .. dir) end
    local file = io.open(save_path, "wb")
    if file then
        file:write(table.concat(response_body))
        file:close()
        consoleLog(session, "INFO", "音频下载成功：" .. save_path)
        return save_path
    end
    return nil
end

-- ===================== Dify调用（极简版，session显式传入） =====================
local function call_dify_asr(session, audio_file, org, uuid,file_name)
    consoleLog(session, "INFO", "调用ASR：" .. audio_file)
    local audio_base64 = audio_to_base64(session, audio_file)
    if not audio_base64 then
        session:execute("say", "zh read cardinal 无法识别语音")
        return nil
    end

    local result = http_request_with_retry(session, "POST",
            config.dify_base_url.."/"..config.dify_api_version.."/workflows/run",
            get_dify_headers(config.asr.api_key),
            {
                workflow_id = config.asr.workflow_id,
                inputs = { audio = audio_base64, org = org, uuid = uuid,file_name = file_name },
                conversation_id = uuid, user = "fs_ivr_"..uuid, response_mode = "blocking"
            },
            config.asr.retry_times
    )

    local text = result and (result.data and result.data.outputs.text or result.outputs.text) or ""
    if text ~= "" then
        consoleLog(session, "INFO", "ASR识别结果：" .. text)
        return text
    else
        consoleLog(session, "ERR", "ASR无结果：" .. dkjson.encode(result))
        session:execute("say", "zh read cardinal 未识别到语音")
        return nil
    end
end

local function call_dify_tts(session, text, org, uuid)
    if not text then
        session:execute("say", "zh read cardinal 无回复内容")
        return nil
    end
    consoleLog(session, "INFO", "调用TTS：" .. text)

    local result = http_request_with_retry(session, "POST",
            config.dify_base_url.."/"..config.dify_api_version.."/workflows/run",
            get_dify_headers(config.tts.api_key),
            {
                workflow_id = config.tts.workflow_id,
                inputs = { text = text, org = org, uuid = uuid },
                conversation_id = uuid, user = "fs_ivr_"..uuid, response_mode = "blocking"
            },
            config.tts.retry_times
    )

    local audio_url = result and (result.data and result.data.outputs.audio_url or result.outputs.audio_url) or ""
    if audio_url ~= "" then
        consoleLog(session, "INFO", "TTS音频URL：" .. audio_url)

        local audio_path = config.temp_audio_path .. "tts_" .. uuid .. ".wav"
        if download_oss_audio(session, audio_url, audio_path) then
            session:execute("playback", audio_path)
            os.remove(audio_path)
        end
        return audio_url
    else
        consoleLog(session, "ERR", "TTS无音频：" .. dkjson.encode(result))
        session:execute("say", "zh read cardinal " .. text)
        return nil
    end
end

local function call_dify_nlp(session, text, org, uuid, conv_id)
    if not text then
        local default = "没听清你的问题，请再说一遍"
        session:execute("say", "zh read cardinal " .. default)
        return default
    end
    consoleLog(session, "INFO", "调用NLP：" .. text)

    local post_data = {
        chatflow_id = config.nlp.chatflow_id,
        query = text, user = "fs_ivr_"..uuid, response_mode = "blocking",inputs = {}
    }
    if conv_id then post_data.conversation_id = conv_id end

    local result = http_request_with_retry(session, "POST",
            config.dify_base_url.."/"..config.dify_api_version.."/chat-messages",
            get_dify_headers(config.nlp.api_key),
            post_data,
            config.nlp.retry_times
    )

    local reply = result and result.answer or "系统暂时无法回复"
    consoleLog(session, "INFO", "NLP回复：" .. reply)
    call_dify_tts(session, reply, org, uuid)
    return { reply = reply, conv_id = result and result.conversation_id or conv_id }
end

-- ===================== IVR主流程（session作为参数传入） =====================
local function ivr_main(session)
    session:answer()
    session:execute("set", "autohangup=false")
    local uuid = session:getVariable("uuid") or "fs_ivr_" .. os.time()
    local conv_id = nil

    create_temp_dir(session)
    consoleLog(session, "INFO", "===== IVR会话启动：" .. uuid .. " =====")

    -- 欢迎语
    call_dify_tts(session, "欢迎使用智能客服", config.org, uuid)

    -- 多轮对话
    local dialog_round = 0
    local retry = 0
    while dialog_round < config.max_dialog_rounds do
        dialog_round = dialog_round + 1
        consoleLog(session, "INFO", "===== 对话轮数：" .. dialog_round .. " =====")

        -- 录音
        local file_name = "record_" .. uuid .. "_" .. dialog_round .. ".wav"
        local record_file = config.temp_audio_path .. file_name
        consoleLog(session, "INFO", "开始录音（超时"..config.ivr_timeout.."秒）")
        local record_result = session:execute("record", record_file .. " " .. config.ivr_timeout .. " silence://2 8000")
        consoleLog(session, "DEBUG", "录音执行结果：" .. tostring(record_result))
        session:sleep(500)
        -- 检查录音文件
        if not io.open(record_file, "rb") then
            consoleLog(session, "WARN", "录音文件不存在，重试")
            retry = retry + 1
            if retry >= config.ivr_retry_times then
                session:execute("say", "zh read cardinal 多次未检测到语音，对话结束")
                break
            else
                session:execute("say", "zh read cardinal 没有听清，请再说一遍")
                goto continue
            end
        end
        retry = 0

        -- ASR -> NLP -> TTS
        local user_text = call_dify_asr(session, record_file, config.org, uuid,file_name)
        os.remove(record_file)
        if user_text then
            local nlp_res = call_dify_nlp(session, user_text, config.org, uuid, conv_id)
            conv_id = nlp_res.conv_id

            -- 结束意图检测
            if string.find(nlp_res.reply, "再见") or string.find(nlp_res.reply, "结束") then
                call_dify_tts(session, "感谢咨询，再见！", config.org, uuid)
                break
            end
        end

        ::continue::
    end

    consoleLog(session, "INFO", "===== IVR会话结束：" .. uuid .. " =====")
    session:execute("hangup")
end

-- ===================== 入口函数（仅接收session参数） =====================
local function main(session)
    session:execute("set", "autohangup=0") -- 彻底禁止自动挂断
    session:execute("set", "session_timeout=60")
    session:execute("set", "hangup_after_bridge=0")
    session:execute("set", "continue_on_fail=1") -- 失败后继续执行
    -- 强制激活媒体通道（解决playback requires media问题）
    -- session:execute("set", "media_must_be_answered=true")
    -- session:execute("set", "rtp_autofix=true")
    -- 启用媒体流
    -- session:execute("media", "reset")
    -- session:execute("media", "active")
    local ok, err = pcall(ivr_main, session)
    if not ok then
        consoleLog(session, "ERR", "IVR执行异常：" .. err)
        session:answer()
        session:execute("say", "zh read cardinal 系统异常，请稍后再试")
        session:execute("hangup")
    end
end

-- 启动（FS中调用时会自动传入session参数）
main(session)
