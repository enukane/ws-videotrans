require 'em/pure_ruby'
require "em-websocket"
require 'securerandom'
require "json"
require "pp"

SESSIONS = {}
# uuid : { connections: [] }
CONNECTIONS = {}

def get_uuid
  return SecureRandom.uuid
end

def generate_connection_id
end

def create_connection id, wsconn
  CONNECTIONS[id] = {
    "joinded_session_id" => nil,
    "conn" =>  wsconn
  }
end

def delete_connection id
  joined_session_id = CONNECTIONS[id]["joined_session_id"]
  if joined_session_id != nil
    SESSIONS[joined_session_id]["connections"].delete(id)
  end
  CONNECTIONS.delete(id)
end

def create_session
  uuid = get_uuid()
  SESSIONS[uuid] = {
    "connections" => []
  }
end

def get_addr_port(wsconn)
  port, addr = Socket.unpack_sockaddr_in(wsconn.get_peername)
  addr_port = addr + ":" + port.to_s
  return addr_port
end

def parse_and_process_msg(msg, wsconn)
  # {
  #   "type": get_session | create_session | join_session |  sessions
  #
  #
  # }
  begin
    json = JSON.parse(msg)
  rescue
    return null
  end


end

def get_sessions()
  SESSIONS.keys
end

def delete_session(id)
  SESSIONS.delete(id)
end

def join_session(conn_id, session_id)
  if SESSIONS[session_id].nil?
    return false
  end

  if CONNECTIONS[conn_id].nil?
    return false
  end

  CONNECTIONS[conn_id]["joined_session_id"] = session_id
  SESSIONS[session_id]["connections"].push(conn_id)
end

def handle_control_data(conn_id, msg)

end

def forward_msg(conn_id, msg)
  session_id = CONNECTIONS[conn_id]["joined_session_id"]
  if session_id.nil?
    return {
      "type" => "error",
      "reason" => "not connected"
    }
  end

  peer_conn_ids = (SESSIONS[session_id]["connections"] - [conn_id])

  if peer_conn_ids.empty?
    return {
      "type" => "error",
      "reason" => "no peer found"
    }
  end

  if peer_conn_ids.nil?
    return {
      "type" => "error",
      "reason" => "invalid peer"
    }
  end

  peer_conn_ids.each do |peer_conn_id|
    wsconn = CONNECTIONS[peer_conn_id]["conn"]
    wsconn.send(msg)
  end

  nil
rescue => e
  p e
  nil
end

EM::WebSocket.start({:host => "0.0.0.0", :port => 18888}) do |wsconn|
  conn_id = SecureRandom.uuid

  wsconn.onopen{|handshake|
    puts "onopen #{conn_id}"
    create_connection(conn_id, wsconn)
    puts "onopen => #{CONNECTIONS}"
  }

  wsconn.onclose { |event|
    puts "onclose #{conn_id}"
    delete_connection(conn_id)
  }

  wsconn.onerror { |reason|
    puts "onerror #{conn_id} : reason=#{reason}"
  }

  wsconn.onbinary { |msg|
    puts "onbinary #{conn_id}"

    parse_and_process_msg(msg, wsconn)
  }

  wsconn.onmessage {|msg|
    #puts "onmessage #{conn_id}"
    json = JSON.parse(msg)
    ret_msg = {}

    case json["type"]
    when "connection_info"
      ret_msg = {
        "type" => "connection_info",
        "connection_id" => conn_id,
        "joined_session_id" => CONNECTIONS[conn_id]["joined_session_id"]
      }
    when "get_sessions"
      ret_msg = {
        "type" => "sessions",
        "ids" => get_sessions(),
      }
    when "create_session"
      create_session()
      ret_msg = {
        "type" => "sessions",
        "ids" => get_sessions(),
      }
    when "delete_session"
      puts "delete session_id=#{json["id"]}"
      session_id = json["id"]
      delete_session(session_id)
      ret_msg = {
        "type" => "sessions",
        "ids" => get_sessions(),
      }
    when "join_session"
      p "received join session"
      session_id = json["id"]
      if join_session(conn_id, session_id)
        ret_msg = {
          "type" => "connection_ready",
          "session_id" => session_id,
          "conn_id" => conn_id
        }
      else
        ret_msg = {
          "type": "error",
          "reaason": "failed to join #{session_id} (conn: #{conn_id}"
        }
      end
    when "control_data"
      ret_msg = forward_msg(conn_id, msg)
    when "data"
      ret_msg = forward_msg(conn_id, msg)
    else
      ret_msg = {
        "type" => "error",
        "reason" => "unknown type",
      }
    end

    if !ret_msg.nil?
      ret_msg_json = JSON.dump(ret_msg)
      wsconn.send(ret_msg_json)
    end
  }

end
