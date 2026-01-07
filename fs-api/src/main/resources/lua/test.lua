-- ===================== 测试配置（需替换为实际值）=====================
local test_config = {
    dify_base_url = "http://121.43.122.41:180",
    dify_api_version = "v1",
    -- ASR测试
    asr_workflow_id = "xS2uaYQW4MQeLVYC",
    asr_api_key = "app-ZRBnzeQ0j32dESy3A89M0qMV",
    test_audio_file = "/tmp/test_audio.wav",  -- 本地测试音频文件（8kHz/16bit/单声道WAV）
    -- TTS测试
    tts_workflow_id = "uwm0LXSdABRA67mL",
    tts_api_key = "app-0SXzFGbR8GR8ezrg5WTQ7NIj",
    test_tts_text = "测试TTS接口，这是一段测试文本",
    -- NLP测试
    nlp_chatflow_id = "ifOeClexyjNsw1kp",
    nlp_api_key = "app-rqbwIN5nSrbsLSkCp3HSQPPe",
    test_nlp_queries = {"你好", "请问今天天气怎么样？", "再见"},  -- 多轮测试语句
    -- 通用参数
    org = "13800138000",
    uuid = freeswitch.UUID.generate(),
    conversation_id = freeswitch.UUID.generate(),
    retry_times = 1
}

-- ===================== 复用工具函数（同IVR脚本）=====================
local function get_dify_headers(api_key)
    return {["Content-Type"] = "application/json", ["Authorization"] = "Bearer " .. api_key}
end

local function http_request_with_retry(method, url, headers, post_data, retry_times)
    local retry = 0
    local result = nil
    while retry <= retry_times do
        local header_str = ""
        for k, v in pairs(headers) do
            header_str = header_str .. k .. ": " .. v .. "\r\n"
        end
        local post_data_str = post_data and freeswitch.JSON.encode(post_data) or ""
        local http_cmd = string.format("%s %s %s %s", method, url, header_str, post_data_str)
        local response = freeswitch.API():execute("http_client", http_cmd)
        local resp_json = freeswitch.JSON.decode(response)
        if resp_json and (resp_json.data or resp_json.answer) then
            result = resp_json
            break
        else
            print("请求失败（重试"..retry.."）："..response)
            retry = retry + 1
            freeswitch.msleep(500)
        end
    end
    return result
end

local function audio_to_base64(audio_path)
    local file = io.open(audio_path, "rb")
    if not file then print("音频文件不存在："..audio_path) return nil end
    local audio_data = file:read("*a")
    file:close()
    return freeswitch.base64.encode(audio_data)
end

-- ===================== 测试函数 =====================
-- 1. 测试ASR Workflow
local function test_asr()
    print("\n=== 测试ASR Workflow ===")
    local audio_base64 = audio_to_base64(test_config.test_audio_file)
    if not audio_base64 then return end

    local asr_url = string.format("%s/%s/workflows/run", test_config.dify_base_url, test_config.dify_api_version)
    local post_data = {
        workflow_id = test_config.asr_workflow_id,
        inputs = {
            audio = audio_base64,
            file_name = string.match(test_config.test_audio_file, "/([^/]+)$"),
            org = test_config.org,
            uuid = test_config.uuid
        },
        response_mode = "blocking",
        user = "test_user_" .. test_config.uuid
    }

    local result = http_request_with_retry("POST", asr_url, get_dify_headers(test_config.asr_api_key), post_data, test_config.retry_times)
    if result and result.data and result.data.outputs and result.data.outputs.text then
        print("ASR识别结果："..result.data.outputs.text)
    else
        print("ASR测试失败")
    end
end

-- 2. 测试TTS Workflow
local function test_tts()
    print("\n=== 测试TTS Workflow ===")
    local tts_url = string.format("%s/%s/workflows/run", test_config.dify_base_url, test_config.dify_api_version)
    local post_data = {
        workflow_id = test_config.tts_workflow_id,
        inputs = {
            text = test_config.test_tts_text,
            org = test_config.org,
            uuid = test_config.uuid
        },
        response_mode = "blocking",
        user = "test_user_" .. test_config.uuid
    }

    local result = http_request_with_retry("POST", tts_url, get_dify_headers(test_config.tts_api_key), post_data, test_config.retry_times)
    if result and result.data and result.data.outputs and result.data.outputs.audio_url then
        print("TTS音频地址："..result.data.outputs.audio_url)
    else
        print("TTS测试失败")
    end
end

-- 3. 测试NLP Chatflow（多轮）
local function test_nlp()
    print("\n=== 测试NLP Chatflow（多轮）===")
    local nlp_url = string.format("%s/%s/chat-messages", test_config.dify_base_url, test_config.dify_api_version)
    for i, query in ipairs(test_config.test_nlp_queries) do
        local post_data = {
            chatflow_id = test_config.nlp_chatflow_id,
            inputs = {},
            query = query,
            conversation_id = test_config.conversation_id,
            user = "test_user_" .. test_config.uuid,
            response_mode = "blocking"
        }
        local result = http_request_with_retry("POST", nlp_url, get_dify_headers(test_config.nlp_api_key), post_data, test_config.retry_times)
        if result and result.answer then
            print("第"..i.."轮提问："..query)
            print("第"..i.."轮回复："..result.answer.."\n")
        else
            print("第"..i.."轮NLP测试失败\n")
        end
        freeswitch.msleep(1000)  -- 避免接口调用过快
    end
end

-- ===================== 执行测试 =====================
print("开始测试Dify接口...")
test_asr()   -- 测试ASR
test_tts()   -- 测试TTS
test_nlp()   -- 测试NLP多轮对话
print("测试完成！")
