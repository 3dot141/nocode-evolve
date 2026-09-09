#!/bin/bash

PLUGIN_URL="https://fx-develop.oss-cn-hangzhou.aliyuncs.com/es/ai_tokenizer-8.15.5.zip"
PLUGIN_NAME="ai_tokenizer"
PLUGIN_DIR="/usr/share/elasticsearch/plugins/${PLUGIN_NAME}"
TEMP_DIR="/tmp/${PLUGIN_NAME}_install"

# 检查插件是否已安装
if [ ! -d "${PLUGIN_DIR}" ]; then
    echo "Installing plugin ${PLUGIN_NAME}..."
    # 清理临时目录
    rm -rf "${TEMP_DIR}"
    mkdir -p "${TEMP_DIR}"
    
    # 下载并解压
    if curl -f -L -o "${TEMP_DIR}/${PLUGIN_NAME}.zip" "${PLUGIN_URL}"; then
        unzip -o -q "${TEMP_DIR}/${PLUGIN_NAME}.zip" -d "${TEMP_DIR}"
        
        # 移动插件目录（如果解压后有插件目录，直接移动；否则移动所有内容）
        rm -rf "${PLUGIN_DIR}"
        if [ -d "${TEMP_DIR}/${PLUGIN_NAME}" ]; then
            mv "${TEMP_DIR}/${PLUGIN_NAME}" "${PLUGIN_DIR}"
        else
            mkdir -p "${PLUGIN_DIR}"
            mv "${TEMP_DIR}"/* "${PLUGIN_DIR}/" 2>/dev/null || true
            rm -f "${PLUGIN_DIR}/${PLUGIN_NAME}.zip"
        fi
        
        chmod -R 755 "${PLUGIN_DIR}"
        rm -rf "${TEMP_DIR}"
        echo "Plugin ${PLUGIN_NAME} installed successfully."
    fi
fi

exec /usr/local/bin/docker-entrypoint.sh eswrapper
